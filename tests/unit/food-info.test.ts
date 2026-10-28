import { describe, expect, it } from "vitest";
import { formatUnitPrice, missingFoodInfo, parseSizeLabel, unitPrice, type FoodInfo } from "@/lib/food-info";

const complete: FoodInfo = {
  ingredients: "Kichererbsen, Wasser, Salz",
  allergens: [],
  allergensConfirmed: true,
  nutrition: { energyKj: 500, energyKcal: 120, fat: 2, saturates: 0.3, carbs: 15, sugars: 0.5, protein: 7, salt: 0.6 },
  manufacturer: "Doruk Gıda, Istanbul, Türkei",
  sizes: [{ label: "800 g", sizeValue: 800, sizeUnit: "g" }],
};

describe("missingFoodInfo", () => {
  it("is empty for a complete product", () => {
    expect(missingFoodInfo(complete)).toEqual([]);
  });

  it("lists everything for a product with no food information yet", () => {
    expect(missingFoodInfo({ sizes: [{ label: "1 Stück" }] })).toEqual(["ingredients", "allergens", "nutrition", "manufacturer", "netQuantity"]);
  });

  it("accepts an empty allergen list only once it is confirmed", () => {
    expect(missingFoodInfo({ ...complete, allergensConfirmed: false })).toEqual(["allergens"]);
  });

  it("treats a 0 nutrient as filled, but not a missing one", () => {
    expect(missingFoodInfo({ ...complete, nutrition: { ...complete.nutrition, fat: 0 } })).toEqual([]);
    const { salt: _salt, ...noSalt } = complete.nutrition!;
    expect(missingFoodInfo({ ...complete, nutrition: noSalt })).toEqual(["nutrition"]);
  });

  it("skips ingredients and nutrition when the owner marks them as not required", () => {
    expect(missingFoodInfo({ ...complete, ingredients: "", ingredientsNotRequired: true, nutrition: null, nutritionNotRequired: true })).toEqual([]);
  });

  it("needs a net quantity on every size", () => {
    expect(missingFoodInfo({ ...complete, sizes: [complete.sizes![0], { label: "1 Stück", sizeValue: null, sizeUnit: null }] })).toEqual(["netQuantity"]);
    expect(missingFoodInfo({ ...complete, sizes: [{ sizeValue: 0, sizeUnit: "g" }] })).toEqual(["netQuantity"]);
    expect(missingFoodInfo({ ...complete, sizes: [{ sizeValue: 6, sizeUnit: "pcs" }] })).toEqual([]);
  });
});

describe("parseSizeLabel", () => {
  it("reads common label formats", () => {
    expect(parseSizeLabel("500 g")).toEqual({ value: 500, unit: "g" });
    expect(parseSizeLabel("1,5 l")).toEqual({ value: 1.5, unit: "l" });
    expect(parseSizeLabel("4.5 kg")).toEqual({ value: 4.5, unit: "kg" });
    expect(parseSizeLabel("25cl")).toEqual({ value: 250, unit: "ml" });
    expect(parseSizeLabel("Dose 400 ml")).toEqual({ value: 400, unit: "ml" });
  });

  it("returns null for pieces and unknown labels", () => {
    expect(parseSizeLabel("1 Stück")).toBeNull();
    expect(parseSizeLabel("100 Teebeutel")).toBeNull();
    expect(parseSizeLabel("10 Scheiben")).toBeNull();
    expect(parseSizeLabel("")).toBeNull();
  });
});

describe("unitPrice", () => {
  it("gives the price per kg or litre", () => {
    expect(unitPrice(2.49, 500, "g")).toEqual({ amount: 4.98, per: "kg" });
    expect(unitPrice(12.99, 4.5, "kg")).toEqual({ amount: 2.89, per: "kg" });
    expect(unitPrice(1.29, 1.5, "l")).toEqual({ amount: 0.86, per: "l" });
    expect(unitPrice(0.99, 330, "ml")).toEqual({ amount: 3, per: "l" });
  });

  it("is null for pieces or an unknown quantity", () => {
    expect(unitPrice(1, 6, "pcs")).toBeNull();
    expect(unitPrice(1, null, "g")).toBeNull();
    expect(unitPrice(1, 0, "g")).toBeNull();
  });

  it("formats in German style", () => {
    expect(formatUnitPrice(2.49, 500, "g")).toBe("4,98 €/kg");
    expect(formatUnitPrice(1, null, null)).toBe("");
  });
});
