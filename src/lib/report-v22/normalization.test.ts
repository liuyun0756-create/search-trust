import { describe, expect, it } from "vitest";
import data from "./generated/normalization-data.json";
import { casefold, competitorWebsiteKey, isBlankQuery, stripString } from "./normalization";

describe("backend-compatible semantic comparisons", () => {
  it("uses every generated full-casefold mapping without locale dependence", () => {
    for (const [character, expected] of Object.entries(data.casefold)) expect(casefold(character)).toBe(expected);
    expect(casefold("Straße")).toBe("strasse");
    expect(casefold("ΟΣ οσ ος")).toBe("οσ οσ οσ");
    expect(casefold("I ı İ")).toBe("i ı i\u0307");
    expect(casefold("𐐀")).toBe("𐐨");
    expect(casefold("plain文字")).toBe("plain文字");
  });

  it("uses Pydantic whitespace for stripping and Python whitespace for blank queries", () => {
    for (const character of data.string_whitespace) expect(stripString(`${character}hello${character}`)).toBe("hello");
    for (const character of data.python_whitespace) expect(isBlankQuery(character)).toBe(true);
    expect(stripString("\ufeffhello\ufeff")).toBe("\ufeffhello\ufeff");
    expect(isBlankQuery("\ufeff")).toBe(false);
    expect(stripString(" a  b ")).toBe("a  b");
    expect(isBlankQuery("")).toBe(true);
  });

  it("compares complete URLs, retaining path and query differences", () => {
    expect(competitorWebsiteKey("https://EXAMPLE.test:443")).toBe("https://example.test/");
    expect(competitorWebsiteKey("https://example.test/a")).not.toBe(competitorWebsiteKey("https://example.test/b"));
    expect(competitorWebsiteKey("https://example.test/?x=1")).not.toBe(competitorWebsiteKey("https://example.test/?x=2"));
    expect(competitorWebsiteKey("not a url")).toBeNull();
    expect(competitorWebsiteKey("ftp://example.test/")).toBeNull();
  });
});
