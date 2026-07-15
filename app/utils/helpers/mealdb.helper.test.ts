import { describe, it, expect } from "vitest";
import { mealToImported, mealsToResults } from "./mealdb.helper";

const SAMPLE = {
  idMeal: "52940",
  strMeal: "Brown Stew Chicken",
  strCategory: "Chicken",
  strArea: "Jamaican",
  strInstructions:
    "Squeeze the lime over the chicken.\r\nMarinate for 2 hours.\r\nReady in: 45 min",
  strMealThumb:
    "https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg",
  strTags: "Stew",
  strSource: "https://example.com/brown-stew-chicken",
  strIngredient1: "Chicken",
  strMeasure1: "1 whole",
  strIngredient2: "Tomato",
  strMeasure2: "2 chopped",
  strIngredient3: "Soy Sauce",
  strMeasure3: "2 tbs",
  strIngredient4: "",
  strMeasure4: " ",
};

describe("mealToImported", () => {
  it("maps name, image, source, category/area", () => {
    const r = mealToImported(SAMPLE);
    expect(r.name).toBe("Brown Stew Chicken");
    expect(r.imageUrl).toContain("themealdb.com");
    expect(r.sourceUrl).toBe("https://example.com/brown-stew-chicken");
    expect(r.category).toBe("Chicken");
    expect(r.area).toBe("Jamaican");
    expect(r.id).toBe("52940");
  });

  it("maps ingredients with parsed measures, skipping blanks", () => {
    const r = mealToImported(SAMPLE);
    expect(r.ingredients).toHaveLength(3); // blank #4 dropped
    expect(r.ingredients[0]).toEqual({ name: "chicken", amount: 1 });
    expect(r.ingredients[2]).toEqual({
      name: "soy sauce",
      amount: 2,
      unit: "tbsp",
    });
  });

  it("splits instructions into steps and reads a time hint", () => {
    const r = mealToImported(SAMPLE);
    expect(r.steps.map((s) => s.text)).toEqual([
      "Squeeze the lime over the chicken.",
      "Marinate for 2 hours.",
      "Ready in: 45 min",
    ]);
    expect(r.minutes).toBe(45);
  });

  it("collects tags from strTags + area + category", () => {
    const r = mealToImported(SAMPLE);
    expect(r.tags).toEqual(
      expect.arrayContaining(["stew", "jamaican", "chicken"]),
    );
  });
});

describe("mealsToResults", () => {
  it("maps an array and tolerates null", () => {
    expect(mealsToResults([SAMPLE])).toHaveLength(1);
    expect(mealsToResults(null)).toEqual([]);
  });
});
