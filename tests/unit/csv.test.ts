import { describe, expect, it } from "vitest";
import { parseCsv, parseDecimal, toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("writes a UTF-8 BOM, semicolons and CRLF line endings for Excel", () => {
    const out = toCsv([
      ["a", "b"],
      [1, 2],
    ]);
    expect(out).toBe("﻿a;b\r\n1;2\r\n");
  });

  it("quotes cells containing separators, quotes or line breaks", () => {
    expect(toCsv([["Öl; extra", 'Sie sagte "hallo"', "zwei\nZeilen"]])).toBe('﻿"Öl; extra";"Sie sagte ""hallo""";"zwei\nZeilen"\r\n');
  });

  it("writes empty cells for null and undefined", () => {
    expect(toCsv([[null, undefined, 0]])).toBe("﻿;;0\r\n");
  });
});

describe("formula protection (CSV injection)", () => {
  it("writes formula-like text with a leading apostrophe so Excel doesn't run it", () => {
    const out = toCsv([['=HYPERLINK("http://evil","x")', "+49 170 123", "@SUM(A1)", "-1+2"]]);
    expect(out.slice(1)).toBe(`"'=HYPERLINK(""http://evil"",""x"")";'+49 170 123;'@SUM(A1);'-1+2\r\n`);
  });

  it("leaves numbers and normal text alone", () => {
    expect(toCsv([[-5, 2.49, "Durra"]]).slice(1)).toBe("-5;2.49;Durra\r\n");
  });

  it("imports an exported file unchanged", () => {
    const rows = [["name", "telefon"], ["=1+1", "+49 170 123"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("parseCsv", () => {
  it("round-trips what toCsv writes", () => {
    const rows = [
      ["variant_id", "produkt", "preis"],
      ["abc", 'Durra "XXL"; 4,5 kg', "2,49"],
      ["def", "zwei\nZeilen", ""],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("detects comma-separated files (e.g. saved by Google Sheets)", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a;b\n\n1;2\n;\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles a last line without a line break", () => {
    expect(parseCsv("a;b\r\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseDecimal", () => {
  it.each([
    ["2,49", 2.49],
    ["2.49", 2.49],
    ["€ 3,99", 3.99],
    ["10", 10],
  ])("%s → %s", (input, expected) => expect(parseDecimal(input)).toBe(expected));

  it.each([[""], ["  "], ["abc"], [undefined]])("%s → null", (input) => expect(parseDecimal(input)).toBeNull());
});
