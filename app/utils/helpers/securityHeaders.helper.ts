// Response security headers for the SSR document. Kept pure (returns a plain
// record) so the policy is unit-testable; `entry.server` applies it to every
// HTML response.
//
// CSP is shipped **Report-Only** first: this app renders arbitrary external
// images (recipes, product photos) and embeds Clerk (which injects its own
// scripts, an iframe for bot-protection, and talks to *.clerk.* + Cloudflare
// Turnstile). An enforcing policy that's even slightly wrong would break
// sign-in, and Clerk's exact origins can't be exercised in the sandbox — so we
// observe violations for a while, then promote to enforcing by flipping
// CSP_HEADER. The non-CSP headers are safe to enforce immediately.

/** Clerk + Google Fonts + Turnstile origins the document legitimately needs. */
const CLERK = "https://*.clerk.accounts.dev https://*.clerk.com";
const TURNSTILE = "https://challenges.cloudflare.com";

/** Report-Only CSP directive string. Deliberately permissive on img/style. */
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    // Clerk injects its SDK; RR hydration + Clerk use inline bootstrapping.
    `script-src 'self' 'unsafe-inline' ${CLERK} ${TURNSTILE}`,
    // Tailwind + Google Fonts stylesheet.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Recipe / product images are arbitrary remote URLs.
    "img-src 'self' data: https:",
    `connect-src 'self' ${CLERK}`,
    // Clerk's bot-protection + hosted components render in frames.
    `frame-src 'self' ${CLERK} ${TURNSTILE}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Build the security headers for an HTML response. `isProd` gates HSTS (never
 * send it off HTTPS/dev). Returned as a record the caller sets onto `Headers`.
 */
export function buildSecurityHeaders(isProd: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    // Enforced immediately — none of these can break a correct app.
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    // Observed first (see module note), promoted to `Content-Security-Policy`
    // once violation reports are clean.
    "Content-Security-Policy-Report-Only": contentSecurityPolicy(),
  };
  if (isProd) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }
  return headers;
}
