// Small browser-side helper for the admin portal's JSON routes.
// Throws an Error with the server's message so callers can show it in a toast.

export type AdminWriteResult = { warning?: string } & Record<string, unknown>;

export async function adminRequest(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<AdminWriteResult> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    // Empty or non-JSON body.
  }

  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload as AdminWriteResult;
}
