import { describe, it, expect } from "vitest";
import { buildSecurityHeaders } from "./securityHeaders.helper";

describe("buildSecurityHeaders", () => {
  it("always sets the immediately-enforceable headers", () => {
    const h = buildSecurityHeaders(false);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=(self)");
  });

  it("ships CSP as Report-Only (not enforcing) for now", () => {
    const h = buildSecurityHeaders(true);
    expect(h["Content-Security-Policy-Report-Only"]).toBeDefined();
    expect(h["Content-Security-Policy"]).toBeUndefined();
  });

  it("CSP allows Clerk, Google Fonts and arbitrary https images", () => {
    const csp =
      buildSecurityHeaders(true)["Content-Security-Policy-Report-Only"];
    expect(csp).toContain("*.clerk.accounts.dev");
    expect(csp).toContain("fonts.gstatic.com");
    expect(csp).toContain("img-src 'self' data: https:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("sends HSTS only in production", () => {
    expect(buildSecurityHeaders(true)["Strict-Transport-Security"]).toContain(
      "max-age=",
    );
    expect(
      buildSecurityHeaders(false)["Strict-Transport-Security"],
    ).toBeUndefined();
  });
});
