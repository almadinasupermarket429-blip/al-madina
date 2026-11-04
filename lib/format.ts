// lib/format.ts
export function formatCurrency(
  amount: number,
  currency: string = "EUR",
  locale: string = "de-DE"
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

/**
 * Date (and optionally time) in the shop's language and timezone. Without an explicit locale the
 * browser's own language wins, so a German page on an English phone would show "11/4/2026 03:50 PM".
 */
export function formatDate(value: string | Date, language: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(value).toLocaleString(language === "en" ? "en-GB" : "de-DE", {
    timeZone: "Europe/Berlin",
    ...(Object.keys(options).length ? options : { day: "2-digit", month: "2-digit", year: "numeric" }),
  });
}
