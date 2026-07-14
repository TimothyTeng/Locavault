import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { clerkMiddleware, rootAuthLoader } from "@clerk/react-router/server";
import { ClerkProvider } from "@clerk/react-router";
import { ErrorState } from "~/components/common/errorState";
import { RouteProgress } from "~/components/common/routeProgress";
import { ToastProvider } from "~/components/common/toast";
import { logError } from "~/lib/logger";

export const middleware: Route.MiddlewareFunction[] = [clerkMiddleware()];

export const loader = (args: Route.LoaderArgs) => rootAuthLoader(args);

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#059669" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  // Register the service worker for installability + a resilient shell. Prod only
  // — a dev service worker would cache HMR assets and fight the dev server.
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return (
    <ClerkProvider loaderData={loaderData}>
      <ToastProvider>
        <RouteProgress />
        <Outlet />
      </ToastProvider>
    </ClerkProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  logError(error, { boundary: "root" });
  return <ErrorState error={error} />;
}
