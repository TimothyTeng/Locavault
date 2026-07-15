import { describe, it, expect } from "vitest";
import { parseReceipt, receiptTotalCents } from "./receipt.helper";

describe("parseReceipt", () => {
  it("parses simple name + price lines and de-SHOUTs names", () => {
    const rows = parseReceipt("MILK 2L 3.49\nBREAD WHOLEMEAL 2.00");
    expect(rows).toEqual([
      { name: "Milk 2l", quantity: 1, costCents: 349 },
      { name: "Bread Wholemeal", quantity: 1, costCents: 200 },
    ]);
  });

  it("skips totals, tax, and tender scaffolding", () => {
    const rows = parseReceipt(
      [
        "Eggs 4.29",
        "SUBTOTAL 4.29",
        "TAX 0.30",
        "TOTAL 4.59",
        "VISA 4.59",
        "CHANGE 0.00",
      ].join("\n"),
    );
    expect(rows.map((r) => r.name)).toEqual(["Eggs"]);
  });

  it("reads a leading quantity as unit cost = total / qty", () => {
    const rows = parseReceipt("2 Milk 6.98");
    expect(rows).toEqual([{ name: "Milk", quantity: 2, costCents: 349 }]);
  });

  it("handles the 'N @ unitprice' pattern with a trailing line total (inline)", () => {
    const rows = parseReceipt("Apples 3 @ 1.50 4.50");
    expect(rows[0]).toEqual({ name: "Apples", quantity: 3, costCents: 150 });
  });

  it("attaches a 'N @ price' line to the product name above it", () => {
    const rows = parseReceipt("Apples\n3 @ 1.50 4.50");
    expect(rows[0]).toEqual({ name: "Apples", quantity: 3, costCents: 150 });
  });

  it("does not treat an embedded pack size as a quantity", () => {
    const rows = parseReceipt("EGGS 12PK 4.29");
    expect(rows).toEqual([{ name: "Eggs 12pk", quantity: 1, costCents: 429 }]);
  });

  it("attaches a price-only line to the name above it", () => {
    const rows = parseReceipt("Organic Bananas\n1.24");
    expect(rows).toEqual([
      { name: "Organic Bananas", quantity: 1, costCents: 124 },
    ]);
  });

  it("skips refund / discount lines with negative amounts", () => {
    const rows = parseReceipt("Coupon Saving -1.00\nRice 2.50");
    expect(rows.map((r) => r.name)).toEqual(["Rice"]);
  });

  it("strips SKU/UPC runs and tax-code suffixes", () => {
    const rows = parseReceipt("PASTA 0012345678 1.99 F");
    expect(rows).toEqual([{ name: "Pasta", quantity: 1, costCents: 199 }]);
  });

  it("drops header/address/footer noise without prices", () => {
    const rows = parseReceipt(
      [
        "WALMART SUPERCENTER",
        "123 Main Street",
        "Tel: 555-0100",
        "www.walmart.com",
        "Butter 3.20",
      ].join("\n"),
    );
    expect(rows.map((r) => r.name)).toEqual(["Butter"]);
  });

  it("keeps comma-decimal (European) prices", () => {
    const rows = parseReceipt("Käse 4,50");
    expect(rows[0].costCents).toBe(450);
  });

  it("returns nothing for empty or junk input", () => {
    expect(parseReceipt("")).toEqual([]);
    expect(parseReceipt("\n\n   \n")).toEqual([]);
  });

  it("parses a full realistic receipt", () => {
    const receipt = `
      SAFEWAY
      Store #1234  06/12/2026

      WHOLE MILK 1GAL      4.29
      LARGE EGGS 12CT      3.99
      2 BANANAS            1.16
      SOURDOUGH LOAF       5.49
      GREEK YOGURT 4.00 F
      CHEDDAR 000998877    6.25

      SUBTOTAL            25.18
      TAX                  0.52
      TOTAL               25.70
      DEBIT TEND          25.70
      THANK YOU!
    `;
    const rows = parseReceipt(receipt);
    expect(rows).toEqual([
      { name: "Whole Milk 1gal", quantity: 1, costCents: 429 },
      { name: "Large Eggs 12ct", quantity: 1, costCents: 399 },
      { name: "Bananas", quantity: 2, costCents: 58 },
      { name: "Sourdough Loaf", quantity: 1, costCents: 549 },
      { name: "Greek Yogurt", quantity: 1, costCents: 400 },
      { name: "Cheddar", quantity: 1, costCents: 625 },
    ]);
  });
});

describe("receiptTotalCents", () => {
  it("sums per-unit cost × quantity over priced rows", () => {
    const rows = parseReceipt("2 Milk 6.98\nBread 2.00\nMystery Item");
    // 2×349 + 1×200 + (unpriced → 0)
    expect(receiptTotalCents(rows)).toBe(898);
  });
});
