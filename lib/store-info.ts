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
  { day: 0, de: "Sonntag", en: "Sunday", open: null, close: null }, // Sundays and public holidays closed (Bavarian shop-closing law); holidays: publicHolidays()
];

/** Short opening hours from OPENING_HOURS, e.g. "Mo–Sa 07:00–20:00" (de) or "Mon–Sat 07:00–20:00" (en). */
export function hoursSummary(language: string = "de"): string {
  const short = (d: (typeof OPENING_HOURS)[number]) => (language === "en" ? d.en.slice(0, 3) : d.de.slice(0, 2));
  const week = [1, 2, 3, 4, 5, 6, 0].map((n) => OPENING_HOURS.find((h) => h.day === n)!);
  const groups: { from: (typeof week)[number]; to: (typeof week)[number] }[] = [];
  for (const d of week) {
    const last = groups.at(-1);
    if (!d.open) continue;
    if (last && last.to.open === d.open && last.to.close === d.close && week.indexOf(last.to) === week.indexOf(d) - 1) last.to = d;
    else groups.push({ from: d, to: d });
  }
  return groups
    .map((g) => `${short(g.from)}${g.from === g.to ? "" : `–${short(g.to)}`} ${g.from.open}–${g.from.close}`)
    .join(", ");
}

// ---- Public holidays (Bavaria, as observed in Schweinfurt) ----
// 15 August (Mariä Himmelfahrt) is left out on purpose: in Bavaria it is only a holiday in
// municipalities with a Catholic majority, and the city of Schweinfurt is not one of them.
// Augsburger Friedensfest (8 Aug) only applies in Augsburg. Buß- und Bettag is not a public holiday.

type Holiday = { date: string; de: string; en: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** Easter Sunday (Gregorian calendar, "Anonymous Gregorian algorithm") as YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Adds whole calendar days to a YYYY-MM-DD date (pure date math, no time zone involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weekday of a YYYY-MM-DD date, 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

const holidayCache = new Map<number, Holiday[]>();

/** Public holidays on which the shop is closed, for one year. */
export function publicHolidays(year: number): Holiday[] {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: `${year}-01-01`, de: "Neujahr", en: "New Year's Day" },
    { date: `${year}-01-06`, de: "Heilige Drei Könige", en: "Epiphany" },
    { date: addDays(easter, -2), de: "Karfreitag", en: "Good Friday" },
    { date: addDays(easter, 1), de: "Ostermontag", en: "Easter Monday" },
    { date: `${year}-05-01`, de: "Tag der Arbeit", en: "Labour Day" },
    { date: addDays(easter, 39), de: "Christi Himmelfahrt", en: "Ascension Day" },
    { date: addDays(easter, 50), de: "Pfingstmontag", en: "Whit Monday" },
    { date: addDays(easter, 60), de: "Fronleichnam", en: "Corpus Christi" },
    { date: `${year}-10-03`, de: "Tag der Deutschen Einheit", en: "German Unity Day" },
    { date: `${year}-11-01`, de: "Allerheiligen", en: "All Saints' Day" },
    { date: `${year}-12-25`, de: "1. Weihnachtsfeiertag", en: "Christmas Day" },
    { date: `${year}-12-26`, de: "2. Weihnachtsfeiertag", en: "Boxing Day" },
  ];
  holidayCache.set(year, list);
  return list;
}

/** The public holiday on a YYYY-MM-DD date, or null. */
export function publicHoliday(date: string): Holiday | null {
  return publicHolidays(Number(date.slice(0, 4))).find((h) => h.date === date) ?? null;
}

export function isPublicHoliday(date: string): boolean {
  return publicHoliday(date) != null;
}

/** Date ("YYYY-MM-DD") and time ("HH:MM") of an instant on the Berlin wall clock. */
export function berlinDateTime(now: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hh = get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hh === "24" ? "00" : hh}:${get("minute")}` };
}

/** Opening hours of a date, or null when the shop is closed all day (Sunday or public holiday). */
function hoursOn(date: string) {
  if (isPublicHoliday(date)) return null;
  const h = OPENING_HOURS.find((x) => x.day === weekdayOf(date));
  return h?.open && h.close ? { open: h.open, close: h.close } : null;
}

/** The moment a calendar day (YYYY-MM-DD) starts in Germany, as a Date (handles summer/winter time). */
export function berlinMidnight(date: string): Date {
  for (const offset of ["+01:00", "+02:00"]) {
    const d = new Date(`${date}T00:00:00${offset}`);
    if (berlinDateTime(d).date === date && berlinDateTime(d).time === "00:00") return d;
  }
  return new Date(`${date}T00:00:00+01:00`);
}

/** True for a real calendar date written as YYYY-MM-DD (not 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type OpenState = {
  open: boolean;
  closesAt: string | null;
  /** Legacy German text, e.g. "07:00" (later today) or "Mo 07:00". Prefer `nextOpenAt` for display. */
  nextOpen: string | null;
  /** When the shop opens next, so the UI can translate it: weekday 0 = Sunday … 6 = Saturday. */
  nextOpenAt: { date: string; weekday: number; time: string; today: boolean } | null;
  /** Today's public holiday, if any (shop closed). */
  holiday: { de: string; en: string } | null;
};

/** Current open/closed state in the store's own timezone (Europe/Berlin), including public holidays. */
export function storeOpenState(now: Date = new Date()): OpenState {
  const { date, time } = berlinDateTime(now);
  const h = publicHoliday(date);
  const holiday = h ? { de: h.de, en: h.en } : null;
  const today = hoursOn(date);
  if (today && time >= today.open && time < today.close) {
    return { open: true, closesAt: today.close, nextOpen: null, nextOpenAt: null, holiday };
  }
  // Next opening: later today, or the next day that has hours (skipping Sundays and holidays).
  if (today && time < today.open) {
    return { open: false, closesAt: null, nextOpen: today.open, nextOpenAt: { date, weekday: weekdayOf(date), time: today.open, today: true }, holiday };
  }
  for (let i = 1; i <= 14; i++) {
    const d = addDays(date, i);
    const next = hoursOn(d);
    if (next) {
      const weekday = weekdayOf(d);
      const name = OPENING_HOURS.find((x) => x.day === weekday)?.de ?? "";
      return { open: false, closesAt: null, nextOpen: `${name.slice(0, 2)} ${next.open}`, nextOpenAt: { date: d, weekday, time: next.open, today: false }, holiday };
    }
  }
  return { open: false, closesAt: null, nextOpen: null, nextOpenAt: null, holiday };
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
