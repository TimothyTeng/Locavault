import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { clerkMiddleware, rootAuthLoader } from "@clerk/react-router/server";
import { ClerkProvider } from "@clerk/react-router";
import { ErrorState } from "~/components/common/errorState";
import { RouteProgress } from "~/components/common/routeProgress";

export const middleware: Route.MiddlewareFunction[] = [clerkMiddleware()];

export const loader = (args: Route.LoaderArgs) => rootAuthLoader(args);

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  return (
    <ClerkProvider loaderData={loaderData}>
      <RouteProgress />
      <Outlet />
    </ClerkProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ErrorState error={error} />;
}
