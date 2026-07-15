import { describe, it, expect } from "vitest";
import { safeUrl } from "./url.helper";

describe("safeUrl", () => {
  it("keeps http(s) URLs", () => {
    expect(safeUrl("https://example.com/r")).toBe("https://example.com/r");
    expect(safeUrl("http://blog.test/a")).toBe("http://blog.test/a");
    expect(safeUrl("  https://example.com/r  ")).toBe("https://example.com/r");
  });
  it("rejects javascript: and other dangerous schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
  });
  it("rejects empty / non-string / unparseable input", () => {
    expect(safeUrl("")).toBeNull();
    expect(safeUrl("   ")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
    expect(safeUrl(42)).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
  });
});
