import { getLocaleDirection, normalizeLocale } from "./i18n";

describe("i18n helpers", () => {
  it("normalizes supported browser locales", () => {
    expect(normalizeLocale("es-MX")).toBe("es");
    expect(normalizeLocale("en-US")).toBe("en");
  });

  it("falls back to English for unsupported locales", () => {
    expect(normalizeLocale("fr-FR")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });

  it("identifies RTL locales for document direction support", () => {
    expect(getLocaleDirection("ar")).toBe("rtl");
    expect(getLocaleDirection("he-IL")).toBe("rtl");
    expect(getLocaleDirection("es")).toBe("ltr");
  });
});
