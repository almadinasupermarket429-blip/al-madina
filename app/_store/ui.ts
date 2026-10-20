// Small display helpers shared by storefront components.
import { STORE } from "@/lib/store-info";

export const MAP_URL = STORE.mapUrl;
export const PHONE = STORE.phoneDisplay;
export const PHONE_LINK = `tel:${STORE.phoneE164}`;

/** Swaps a missing product photo for the store logo instead of a broken-image icon. */
export function imageFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = "1";
  img.src = "/logo.png";
  img.style.objectFit = "contain";
  img.style.padding = "18%";
  img.style.background = "#f3efe6";
}

export function slotLabel(slot: { date: string; start: string; end: string }, language: string) {
  const d = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString(language === "de" ? "de-DE" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  return `${d}, ${slot.start}–${slot.end}`;
}

export const euro = (n: number) => `€${n.toFixed(2)}`;
