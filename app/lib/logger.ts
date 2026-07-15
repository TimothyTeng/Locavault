import { isRouteErrorResponse } from "react-router";

type LogContext = Record<string, unknown>;

// Errors already logged — avoids duplicate lines if an error boundary re-renders
// for the same error instance.
const seen = new WeakSet<object>();

/**
 * Lightweight, in-app error sink. Emits one structured JSON line per unexpected
 * error to the console — captured in server logs on SSR (`env: "server"`) or the
 * browser console on the client (`env: "client"`). This is the single place errors
 * funnel through, so swapping the sink for an external service later (Sentry, a log
 * drain, etc.) is a one-file change with no call-site churn.
 *
 * Expected 4xx route responses (404/403 control-flow `throw`s) are ignored — only
 * real failures (5xx, thrown `Error`s, unknown throwables) are logged.
 */
export function logError(error: unknown, context: LogContext = {}): void {
  if (isRouteErrorResponse(error) && error.status < 500) return;
  if (typeof error === "object" && error !== null) {
    if (seen.has(error)) return;
    seen.add(error);
  }

  const detail = isRouteErrorResponse(error)
    ? {
        kind: "route-response",
        status: error.status,
        statusText: error.statusText,
      }
    : error instanceof Error
      ? {
          kind: "error",
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : { kind: "unknown", value: String(error) };

  console.error(
    "[locavault]",
    JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      env: typeof window === "undefined" ? "server" : "client",
      ...context,
      ...detail,
    }),
  );
}
