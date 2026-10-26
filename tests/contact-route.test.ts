import { beforeEach, describe, expect, it, vi } from "vitest";

const mailState = vi.hoisted(() => ({
  sendMail: vi.fn(async (_message: unknown) => ({ provider: "smtp2go", status: "sent" as const, messageId: "m1" })),
  hasSmtp2go: true
}));

vi.mock("@/lib/email/mailer", () => ({ sendMail: mailState.sendMail }));
vi.mock("@/lib/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...original,
    env: new Proxy(original.env, {
      get(target, key) {
        if (key === "hasSmtp2go") return mailState.hasSmtp2go;
        if (key === "enquiriesEmail") return "ops@athenapro.test";
        return Reflect.get(target, key);
      }
    })
  };
});

import { POST } from "@/app/api/contact/route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

const validEnquiry = {
  name: "Jo Bloggs",
  email: "jo@example.com",
  eventType: "Corporate",
  expectedAttendance: "500",
  serviceNeeds: ["Personnel & Operations"],
  brief: "<b>Rooftop</b> launch"
};

describe("contact enquiry route", () => {
  beforeEach(() => {
    mailState.sendMail.mockClear();
    mailState.hasSmtp2go = true;
  });

  it("emails a valid enquiry to the enquiries inbox with the sender as reply-to", async () => {
    const response = await post(validEnquiry);

    expect(response.status).toBe(200);
    expect(mailState.sendMail).toHaveBeenCalledTimes(1);
    const message = mailState.sendMail.mock.calls[0]?.[0] as {
      to: string;
      html: string;
      headers: Record<string, string>;
    };
    expect(message.to).toBe("ops@athenapro.test");
    expect(message.headers["Reply-To"]).toBe("jo@example.com");
    expect(message.html).toContain("&lt;b&gt;Rooftop&lt;/b&gt;");
  });

  it("rejects an invalid enquiry without sending email", async () => {
    const response = await post({ name: "J" });

    expect(response.status).toBe(400);
    expect(mailState.sendMail).not.toHaveBeenCalled();
  });

  it("quietly drops submissions that fill the hidden bot field", async () => {
    const response = await post({ ...validEnquiry, website: "spam.example" });

    expect(response.status).toBe(200);
    expect(mailState.sendMail).not.toHaveBeenCalled();
  });

  it("tells the visitor when email is not configured instead of pretending it was sent", async () => {
    mailState.hasSmtp2go = false;
    const response = await post(validEnquiry);

    expect(response.status).toBe(503);
    expect(mailState.sendMail).not.toHaveBeenCalled();
  });
});
