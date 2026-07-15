// SSRF guard for server-side URL fetching (recipe import). The previous guard
// matched hostnames with a dotted-quad regex, which let exotic IPv4 encodings
// (decimal `http://2130706433`, hex, octal, short `127.1`) and non-`::1` IPv6
// (ULA `fc00::/7`, link-local `fe80::/10`, and IPv4-mapped `::ffff:169.254...`)
// through. The fix: classify by the *resolved* address, not the string. We parse
// the URL, then run `dns.lookup` (the same resolver undici's fetch uses) and
// reject if ANY resolved address is private/reserved. Because the OS resolver
// normalises numeric-host encodings to a real IP before we check it, the encoding
// bypasses collapse. `lookup` is injectable so the logic is unit-testable without
// touching real DNS.
//
// Residual risk: DNS rebinding (a TOCTOU gap between our lookup and undici's
// connect). Documented and accepted for a signed-in, self-service importer; the
// escalation path is a pinned-IP undici Agent.

import net from "node:net";
import dns from "node:dns/promises";

/** Blocked IPv4 + IPv6 ranges: loopback, private, link-local, CGNAT, reserved. */
const blockList = new net.BlockList();
// IPv4
blockList.addSubnet("0.0.0.0", 8, "ipv4"); // "this host"
blockList.addSubnet("10.0.0.0", 8, "ipv4"); // RFC1918
blockList.addSubnet("100.64.0.0", 10, "ipv4"); // CGNAT
blockList.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
blockList.addSubnet("169.254.0.0", 16, "ipv4"); // link-local + cloud metadata
blockList.addSubnet("172.16.0.0", 12, "ipv4"); // RFC1918
blockList.addSubnet("192.168.0.0", 16, "ipv4"); // RFC1918
blockList.addSubnet("192.0.2.0", 24, "ipv4"); // TEST-NET-1
// IPv6
blockList.addAddress("::1", "ipv6"); // loopback
blockList.addSubnet("fc00::", 7, "ipv6"); // unique local (ULA)
blockList.addSubnet("fe80::", 10, "ipv6"); // link-local

/**
 * If `ip` is an IPv4-mapped/compatible IPv6 literal, return the embedded IPv4
 * string so it can be classified as v4 (net.BlockList does not auto-unmap).
 * Handles dotted (`::ffff:169.254.169.254`, `::127.0.0.1`) and hex
 * (`::ffff:a9fe:a9fe`) forms.
 */
export function unmapV4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = lower.match(/^::(?:ffff:)?((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) return dotted[1];
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

/** True if `ip` is a private/reserved address we must never fetch. */
export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return true; // not a valid IP → refuse rather than guess
  if (family === 6) {
    const mapped = unmapV4(ip);
    if (mapped) return isBlockedAddress(mapped);
  }
  return blockList.check(ip, family === 6 ? "ipv6" : "ipv4");
}

/** DNS resolver seam: hostname → its resolved IP strings. */
export type LookupFn = (hostname: string) => Promise<string[]>;

const defaultLookup: LookupFn = async (hostname) => {
  const results = await dns.lookup(hostname, { all: true });
  return results.map((r) => r.address);
};

/**
 * Parse a candidate URL, allowing only http(s), no embedded credentials, and no
 * obviously-internal hostnames. Returns the URL or null. Pure (no DNS).
 */
export function parseHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null; // reject userinfo
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return null;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local"))
    return null;
  return u;
}

export type UrlGuardResult =
  | { ok: true; url: URL }
  | { ok: false; reason: "invalid_url" | "blocked" };

/**
 * Full guard: parse, then verify every resolved address is public. An IP literal
 * host is checked directly (no DNS). Any resolution failure or empty result is
 * treated as blocked. `lookup` is injectable for tests.
 */
export async function checkUrl(
  raw: string,
  lookup: LookupFn = defaultLookup,
): Promise<UrlGuardResult> {
  const url = parseHttpUrl(raw);
  if (!url) return { ok: false, reason: "invalid_url" };

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    return isBlockedAddress(host)
      ? { ok: false, reason: "blocked" }
      : { ok: true, url };
  }

  let addrs: string[];
  try {
    addrs = await lookup(host);
  } catch {
    return { ok: false, reason: "blocked" };
  }
  if (addrs.length === 0 || addrs.some(isBlockedAddress))
    return { ok: false, reason: "blocked" };
  return { ok: true, url };
}
