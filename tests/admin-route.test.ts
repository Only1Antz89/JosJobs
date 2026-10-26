import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const state = vi.hoisted(() => ({
  admin: null as null | { id: string; adminRole: string },
  mode: "live" as "live" | "demo"
}));

vi.mock("@/lib/auth/require-admin", () => {
  class AdminAccessDeniedError extends Error {}
  return {
    AdminAccessDeniedError,
    requireAdmin: vi.fn(async () => {
      if (!state.admin) throw new AdminAccessDeniedError("denied");
      return { adminUser: state.admin };
    })
  };
});

vi.mock("@/lib/env", () => ({ getRuntimeMode: () => state.mode }));

const { adminRoute, readJson } = await import("@/lib/auth/admin-route");

const okHandler = adminRoute<{ id: string }>(
  async (_request, { params, adminUser }) => Response.json({ id: params.id, actor: adminUser.id }),
  { roles: ["finance_admin"], liveOnly: true }
);

function call(handler: typeof okHandler, body?: string) {
  return handler(new Request("http://localhost/api/x", { method: "POST", body }), { params: { id: "abc" } });
}

describe("adminRoute", () => {
  beforeEach(() => {
    state.admin = { id: "admin-1", adminRole: "finance_admin" };
    state.mode = "live";
  });

  it("answers 401 as JSON when nobody is signed in as an admin", async () => {
    state.admin = null;
    const response = await call(okHandler);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("answers 403 when the admin role is not allowed", async () => {
    state.admin = { id: "admin-2", adminRole: "support_admin" };
    expect((await call(okHandler)).status).toBe(403);
  });

  it("always lets super admins through", async () => {
    state.admin = { id: "root", adminRole: "super_admin" };
    const response = await call(okHandler);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "abc", actor: "root" });
  });

  it("refuses live-only actions in demo mode", async () => {
    state.mode = "demo";
    expect((await call(okHandler)).status).toBe(409);
  });

  it("turns validation errors into 400 and app errors into their status", async () => {
    const zodHandler = adminRoute(async (request) => {
      z.object({ name: z.string() }).parse(await readJson(request));
      return Response.json({});
    });
    expect((await call(zodHandler as typeof okHandler, "{}")).status).toBe(400);
    expect((await call(zodHandler as typeof okHandler, "not json")).status).toBe(400);

    const missing = adminRoute(async () => {
      throw new AppError("Client not found.", "NOT_FOUND", 404);
    });
    const response = await call(missing as typeof okHandler);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "Client not found." });
  });

  it("hides unexpected errors behind a generic message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = adminRoute(async () => {
      throw new Error("db password is hunter2");
    });
    const response = await call(broken as typeof okHandler);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("hunter2");
    consoleError.mockRestore();
  });
});
