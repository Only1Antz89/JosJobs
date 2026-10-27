import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function formatFieldLabel(path: (string | number)[]) {
  if (path.length === 0) {
    return "This field";
  }

  const label = String(path[path.length - 1])
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function toDisplayError(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${formatFieldLabel(issue.path)}: ${issue.message}`)
      .join("\n");
  }

  if (error instanceof Error && /failed to fetch|networkerror|load failed|network request failed/i.test(error.message)) {
    return "We couldn't reach Athena Pro. Check your internet connection and try again.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
