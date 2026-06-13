export type Locale = "en" | "es";

export const fallbackLocale: Locale = "en";

const rtlLocales = new Set(["ar", "he", "fa", "ur"]);

export function normalizeLocale(value: string | null | undefined): Locale {
  const normalized = value?.toLowerCase().split("-")[0];
  return normalized === "es" ? "es" : fallbackLocale;
}

export function getLocaleDirection(locale: string) {
  return rtlLocales.has(locale.toLowerCase().split("-")[0]) ? "rtl" : "ltr";
}
