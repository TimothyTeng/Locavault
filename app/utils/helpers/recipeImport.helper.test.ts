import { describe, it, expect } from "vitest";
import {
  iso8601ToMinutes,
  parseIngredientLine,
  parseMeasure,
  parseYield,
  parseRecipeFromJsonLd,
} from "./recipeImport.helper";

describe("parseMeasure", () => {
  it("extracts amount + unit, ignoring trailing prose", () => {
    expect(parseMeasure("2 tablespoons")).toEqual({ amount: 2, unit: "tbsp" });
    expect(parseMeasure("1/2 cup")).toEqual({ amount: 0.5, unit: "cup" });
    expect(parseMeasure("200g")).toEqual({ amount: 200, unit: "g" });
    expect(parseMeasure("4 pounded to 1cm")).toEqual({ amount: 4 });
  });
  it("returns empty for unmeasured text", () => {
    expect(parseMeasure("to taste")).toEqual({});
    expect(parseMeasure("")).toEqual({});
    expect(parseMeasure("a pinch")).toEqual({});
  });
});

describe("iso8601ToMinutes", () => {
  it("parses hours and minutes", () => {
    expect(iso8601ToMinutes("PT1H30M")).toBe(90);
    expect(iso8601ToMinutes("PT45M")).toBe(45);
    expect(iso8601ToMinutes("PT2H")).toBe(120);
    expect(iso8601ToMinutes("P1DT2H")).toBe(1560);
  });
  it("returns undefined for junk", () => {
    expect(iso8601ToMinutes("30 minutes")).toBeUndefined();
    expect(iso8601ToMinutes(null)).toBeUndefined();
    expect(iso8601ToMinutes("PT0M")).toBeUndefined();
  });
});

describe("parseIngredientLine", () => {
  it("splits amount, unit, and name", () => {
    expect(parseIngredientLine("2 tablespoons olive oil")).toEqual({
      name: "olive oil",
      amount: 2,
      unit: "tbsp",
    });
  });
  it("handles fractions and 'of'", () => {
    expect(parseIngredientLine("1/2 cup of flour")).toEqual({
      name: "flour",
      amount: 0.5,
      unit: "cup",
    });
  });
  it("handles unicode fractions and mixed numbers", () => {
    expect(parseIngredientLine("1½ cups sugar")).toEqual({
      name: "sugar",
      amount: 1.5,
      unit: "cup",
    });
  });
  it("keeps the whole line when there's no measurement", () => {
    expect(parseIngredientLine("salt to taste")).toEqual({
      name: "salt to taste",
    });
  });
  it("treats an unknown unit word as part of the name", () => {
    const r = parseIngredientLine("2 large eggs");
    expect(r.amount).toBe(2);
    expect(r.unit).toBeUndefined();
    expect(r.name).toBe("large eggs");
  });
});

describe("parseYield", () => {
  it("extracts a count from strings, numbers, and arrays", () => {
    expect(parseYield(4)).toBe(4);
    expect(parseYield("6 servings")).toBe(6);
    expect(parseYield(["8 servings", "8"])).toBe(8);
    expect(parseYield(undefined)).toBeUndefined();
  });
});

describe("parseRecipeFromJsonLd", () => {
  const page = (json: object) =>
    `<html><head><script type="application/ld+json">${JSON.stringify(
      json,
    )}</script></head><body></body></html>`;

  it("parses a flat Recipe node", () => {
    const html = page({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Pancakes",
      description: "Fluffy",
      image: "https://x/img.jpg",
      recipeIngredient: ["2 cups flour", "1 tbsp sugar"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "Mix" },
        { "@type": "HowToStep", text: "Cook" },
      ],
      totalTime: "PT20M",
      recipeYield: "4 servings",
    });
    const r = parseRecipeFromJsonLd(html)!;
    expect(r.name).toBe("Pancakes");
    expect(r.blurb).toBe("Fluffy");
    expect(r.imageUrl).toBe("https://x/img.jpg");
    expect(r.ingredients).toHaveLength(2);
    expect(r.ingredients[0]).toEqual({ name: "flour", amount: 2, unit: "cup" });
    expect(r.steps.map((s) => s.text)).toEqual(["Mix", "Cook"]);
    expect(r.minutes).toBe(20);
    expect(r.serves).toBe(4);
  });

  it("finds a Recipe nested in an @graph", () => {
    const html = page({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "ignore" },
        { "@type": ["Recipe"], name: "Soup", recipeIngredient: ["1 onion"] },
      ],
    });
    const r = parseRecipeFromJsonLd(html)!;
    expect(r.name).toBe("Soup");
    expect(r.ingredients[0].name).toBe("onion");
  });

  it("returns null when there's no recipe data", () => {
    expect(parseRecipeFromJsonLd("<html></html>")).toBeNull();
    expect(
      parseRecipeFromJsonLd(page({ "@type": "WebPage", name: "x" })),
    ).toBeNull();
  });
});
