// Single source of truth for the store's public business details — matches
// the Google Maps listing ("Al-Madina Markt سوبر ماركت وملحمة المدينة").
// Used by the storefront, legal pages, emails and structured data (JSON-LD).

export const STORE = {
  name: "Al-Madina Markt",
  arabicName: "سوبر ماركت وملحمة المدينة",
  tagline: { de: "Supermarkt & Halal-Metzgerei", en: "Supermarket & halal butcher" },
  street: "Landwehrstraße 12",
  postalCode: "97421",
  city: "Schweinfurt",
  country: "Germany",
  countryCode: "DE",
  phoneDisplay: "0163 8707437",
  phoneE164: "+491638707437",
  plusCode: "26QC+WJ Schweinfurt",
  // Centre of Plus Code 9F2X26QC+WJ (Landwehrstraße 12), decoded by hand.
  geo: { lat: 50.03481, lng: 10.22156 },
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=Al-Madina%20Markt%2C%20Landwehrstra%C3%9Fe%2012%2C%2097421%20Schweinfurt",
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=Al-Madina%20Markt%2C%20Landwehrstra%C3%9Fe%2012%2C%2097421%20Schweinfurt",
  services: [
    { key: "instore", de: "Einkaufen im Laden", en: "In-store shopping" },
    { key: "pickup", de: "Abholung am Straßenrand", en: "Kerbside pickup" },
    { key: "delivery", de: "Lieferung", en: "Delivery" },
  ],
} as const;

/** 0 = Sunday … 6 = Saturday, same as Date#getDay(). null = closed all day. */
export const OPENING_HOURS: { day: number; de: string; en: string; open: string | null; close: string | null }[] = [
  { day: 1, de: "Montag", en: "Monday", open: "07:00", close: "20:00" },
  { day: 2, de: "Dienstag", en: "Tuesday", open: "07:00", close: "20:00" },
  { day: 3, de: "Mittwoch", en: "Wednesday", open: "07:00", close: "20:00" },
  { day: 4, de: "Donnerstag", en: "Thursday", open: "07:00", close: "20:00" },
  { day: 5, de: "Freitag", en: "Friday", open: "07:00", close: "20:00" },
  { day: 6, de: "Samstag", en: "Saturday", open: "07:00", close: "20:00" },
  { day: 0, de: "Sonntag", en: "Sunday", open: null, close: null },
];

/** Current open/closed state in the store's own timezone (Europe/Berlin). */
export function storeOpenState(now: Date = new Date()): { open: boolean; closesAt: string | null; nextOpen: string | null } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const time = `${hh === "24" ? "00" : hh}:${mm}`;

  const today = OPENING_HOURS.find((h) => h.day === day);
  if (today?.open && today.close && time >= today.open && time < today.close) {
    return { open: true, closesAt: today.close, nextOpen: null };
  }
  // Next opening: later today, or the next day that has hours.
  if (today?.open && time < today.open) return { open: false, closesAt: null, nextOpen: today.open };
  for (let i = 1; i <= 7; i++) {
    const next = OPENING_HOURS.find((h) => h.day === (day + i) % 7);
    if (next?.open) return { open: false, closesAt: null, nextOpen: `${next.de.slice(0, 2)} ${next.open}` };
  }
  return { open: false, closesAt: null, nextOpen: null };
}

/** schema.org openingHoursSpecification for JSON-LD. */
export function openingHoursSpecification() {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return OPENING_HOURS.filter((h) => h.open).map((h) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: names[h.day],
    opens: h.open,
    closes: h.close,
  }));
}
