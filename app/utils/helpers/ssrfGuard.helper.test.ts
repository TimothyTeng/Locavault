import { describe, it, expect } from "vitest";
import {
  unmapV4,
  isBlockedAddress,
  parseHttpUrl,
  checkUrl,
  type LookupFn,
} from "./ssrfGuard.helper";

describe("unmapV4", () => {
  it("extracts dotted IPv4-mapped/compatible forms", () => {
    expect(unmapV4("::ffff:169.254.169.254")).toBe("169.254.169.254");
    expect(unmapV4("::127.0.0.1")).toBe("127.0.0.1");
  });
  it("extracts hex IPv4-mapped form", () => {
    expect(unmapV4("::ffff:a9fe:a9fe")).toBe("169.254.169.254");
    expect(unmapV4("::ffff:7f00:0001")).toBe("127.0.0.1");
  });
  it("returns null for genuine IPv6", () => {
    expect(unmapV4("fe80::1")).toBeNull();
    expect(unmapV4("2606:4700:4700::1111")).toBeNull();
  });
});

describe("isBlockedAddress", () => {
  it("blocks loopback / private / link-local IPv4", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("10.1.2.3")).toBe(true);
    expect(isBlockedAddress("192.168.0.1")).toBe(true);
    expect(isBlockedAddress("172.16.5.5")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true); // cloud metadata
    expect(isBlockedAddress("100.64.0.1")).toBe(true); // CGNAT
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
  });
  it("blocks loopback / ULA / link-local IPv6", () => {
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("fc00::1")).toBe(true);
    expect(isBlockedAddress("fe80::abcd")).toBe(true);
  });
  it("blocks IPv4-mapped IPv6 pointing at internal ranges", () => {
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:a9fe:a9fe")).toBe(true);
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
  });
  it("allows public addresses", () => {
    expect(isBlockedAddress("1.1.1.1")).toBe(false);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });
  it("refuses non-IP strings", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

describe("parseHttpUrl", () => {
  it("accepts normal http(s) URLs", () => {
    expect(parseHttpUrl("https://example.com/recipe")?.hostname).toBe(
      "example.com",
    );
    expect(parseHttpUrl("http://blog.test/r")?.hostname).toBe("blog.test");
  });
  it("rejects non-http protocols", () => {
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("file:///etc/passwd")).toBeNull();
    expect(parseHttpUrl("ftp://example.com")).toBeNull();
  });
  it("rejects embedded credentials", () => {
    expect(parseHttpUrl("http://user:pass@example.com")).toBeNull();
  });
  it("rejects internal hostnames outright", () => {
    expect(parseHttpUrl("http://localhost/x")).toBeNull();
    expect(parseHttpUrl("http://foo.local/x")).toBeNull();
  });
  it("rejects garbage", () => {
    expect(parseHttpUrl("not a url")).toBeNull();
  });
});

describe("checkUrl", () => {
  // A lookup that mimics an OS resolver normalising numeric-host encodings to a
  // real IP — this is exactly why the string-encoding bypasses collapse.
  const resolvesTo =
    (
      map: Record<string, string[]>,
      fallback: string[] = ["93.184.216.34"],
    ): LookupFn =>
    async (host) =>
      map[host] ?? fallback;

  it("blocks decimal/hex/octal IPv4-encoded hosts once resolved", async () => {
    const lookup = resolvesTo({
      "2130706433": ["127.0.0.1"],
      "0x7f000001": ["127.0.0.1"],
      "127.1": ["127.0.0.1"],
    });
    for (const raw of [
      "http://2130706433/",
      "http://0x7f000001/",
      "http://127.1/",
    ]) {
      expect((await checkUrl(raw, lookup)).ok).toBe(false);
    }
  });

  it("blocks an IPv6 loopback/metadata literal without DNS", async () => {
    const never: LookupFn = async () => {
      throw new Error("should not resolve an IP literal");
    };
    expect((await checkUrl("http://[::1]/", never)).ok).toBe(false);
    expect((await checkUrl("http://[::ffff:169.254.169.254]/", never)).ok).toBe(
      false,
    );
  });

  it("blocks a public hostname that resolves to a private IP (rebinding-style)", async () => {
    const lookup = resolvesTo({ "evil.example": ["10.0.0.5"] });
    expect((await checkUrl("http://evil.example/", lookup)).ok).toBe(false);
  });

  it("blocks when any of several resolved addresses is private", async () => {
    const lookup = resolvesTo({
      "mixed.example": ["93.184.216.34", "127.0.0.1"],
    });
    expect((await checkUrl("http://mixed.example/", lookup)).ok).toBe(false);
  });

  it("allows a normal public site", async () => {
    const lookup = resolvesTo({ "example.com": ["93.184.216.34"] });
    const res = await checkUrl("https://example.com/recipe", lookup);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url.hostname).toBe("example.com");
  });

  it("blocks on resolution failure or empty result", async () => {
    const throwing: LookupFn = async () => {
      throw new Error("ENOTFOUND");
    };
    expect((await checkUrl("http://nope.example/", throwing)).ok).toBe(false);
    const empty: LookupFn = async () => [];
    expect((await checkUrl("http://empty.example/", empty)).ok).toBe(false);
  });

  it("reports invalid_url for unparseable/blocked-scheme input", async () => {
    const res = await checkUrl("javascript:alert(1)");
    expect(res).toEqual({ ok: false, reason: "invalid_url" });
  });
});
