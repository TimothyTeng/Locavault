import { isRouteErrorResponse, useRouteError } from "react-router";

/**
 * Friendly, presentational error screen. Used by the root and per-route
 * ErrorBoundaries so a thrown loader/render error shows a calm, branded page
 * with a way out — never a blank screen or a raw stack trace in production.
 */
export function ErrorState({ error }: { error: unknown }) {
  let title = "Something went wrong";
  let detail = "An unexpected error occurred. Please try again.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page not found";
      detail = "That page doesn't exist — it may have moved or been removed.";
    } else if (error.status === 403) {
      title = "No access";
      detail = "You don't have permission to view this.";
    } else {
      title = `Error ${error.status}`;
      detail = error.statusText || detail;
    }
  }

  const stack =
    import.meta.env.DEV && error instanceof Error ? error.stack : undefined;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-6 py-16 text-center font-mono">
      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
        Locavault
      </p>
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <p className="max-w-sm text-sm text-slate-500">{detail}</p>
      <a
        href="/"
        className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
      >
        Back to my stores
      </a>
      {stack && (
        <pre className="mt-6 max-w-2xl overflow-x-auto rounded-lg bg-slate-900 p-4 text-left text-[11px] text-slate-300">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

/** Route-level ErrorBoundary: routes can `export { RouteErrorBoundary as ErrorBoundary }`. */
export function RouteErrorBoundary() {
  return <ErrorState error={useRouteError()} />;
}
