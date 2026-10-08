"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Slot = { id: string; date: string; start: string; end: string; capacity: number; booked: number; isActive: boolean };
type Me = { role: "OWNER" | "STAFF" } | null;

const WEEKDAYS: [string, string][] = [
  ["So", "Sun"],
  ["Mo", "Mon"],
  ["Di", "Tue"],
  ["Mi", "Wed"],
  ["Do", "Thu"],
  ["Fr", "Fri"],
  ["Sa", "Sat"],
];

function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

export default function SlotsPage() {
  const { t, language } = useLanguage();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [me, setMe] = useState<Me>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Bulk generator — defaults match the shop's Mon–Sat 07:00–20:00 hours.
  const [fromDate, setFromDate] = useState(today());
  const [days, setDays] = useState(14);
  const [capacity, setCapacity] = useState(8);
  const [windows, setWindows] = useState([
    { start: "10:00", end: "12:00" },
    { start: "14:00", end: "16:00" },
    { start: "17:00", end: "19:00" },
  ]);
  const [skip, setSkip] = useState<number[]>([0]);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((d) => setMe(d.admin));
    load();
  }, []);

  function load() {
    fetch("/api/admin/slots")
      .then((res) => res.json())
      .then((data) => setSlots(Array.isArray(data) ? data : []));
  }

  const isOwner = me?.role === "OWNER";

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return Array.from(map.entries());
  }, [slots]);

  async function generate() {
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generate: { fromDate, days, windows, capacity, skipWeekdays: skip } }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setSlots(data.slots);
    setMessage(t(`${data.created} Zeitfenster erstellt.`, `${data.created} slots created.`));
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/slots/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) setSlots(await res.json());
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/slots/${id}`, { method: "DELETE" });
    if (res.ok) setSlots(await res.json());
  }

  function dayLabel(date: string) {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString(language === "de" ? "de-DE" : "en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    });
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-1">{t("Zeitfenster", "Time slots")}</h1>
      <p className="text-black/50 text-sm mb-6">
        {t(
          "Kunden wählen an der Kasse ein Liefer- bzw. Abholfenster. Volle oder deaktivierte Fenster werden nicht angeboten. Ohne Zeitfenster läuft die Kasse wie bisher.",
          "Customers pick a delivery/pickup window at checkout. Full or disabled windows aren't offered. With no slots, checkout works as before."
        )}
      </p>

      {isOwner && (
        <div className="admin-card mb-6 grid gap-4">
          <h2 className="font-semibold flex items-center gap-2">
            <CalendarPlus size={16} /> {t("Zeitfenster erzeugen", "Generate slots")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="admin-label">{t("Ab Datum", "From date")}</label>
              <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="admin-label">{t("Anzahl Tage", "Number of days")}</label>
              <input type="number" min={1} max={60} className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
            <div>
              <label className="admin-label">{t("Bestellungen pro Fenster", "Orders per window")}</label>
              <input type="number" min={1} max={500} className="input" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="admin-label">{t("Fenster pro Tag", "Windows per day")}</label>
            <div className="grid gap-2">
              {windows.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="time" className="input !w-auto" value={w.start} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                  –
                  <input type="time" className="input !w-auto" value={w.end} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  <button className="btn-outline !px-2.5" onClick={() => setWindows(windows.filter((_, j) => j !== i))} aria-label={t("Fenster entfernen", "Remove window")}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button className="btn-outline w-fit" onClick={() => setWindows([...windows, { start: "08:00", end: "10:00" }])}>
                <Plus size={13} /> {t("Fenster hinzufügen", "Add window")}
              </button>
            </div>
          </div>
          <div>
            <label className="admin-label">{t("Auslassen", "Skip")}</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(([de, en], i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSkip(skip.includes(i) ? skip.filter((x) => x !== i) : [...skip, i])}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${skip.includes(i) ? "bg-black/70 text-white border-black/70" : "bg-white border-black/10 text-black/60"}`}
                >
                  {t(de, en)}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
          {message && <div className="rounded-xl bg-green-50 text-green-700 text-sm px-4 py-3">{message}</div>}
          <button className="btn-primary w-fit" onClick={generate}>
            <CalendarPlus size={14} /> {t("Erzeugen", "Generate")}
          </button>
        </div>
      )}

      {slots === null && <p className="text-black/40 text-sm">{t("Lädt…", "Loading…")}</p>}
      {slots?.length === 0 && <div className="admin-card text-center text-black/40 py-10">{t("Keine kommenden Zeitfenster.", "No upcoming slots.")}</div>}

      <div className="grid gap-4">
        {byDate.map(([date, daySlots]) => (
          <div key={date} className="admin-card">
            <h3 className="font-semibold mb-3">{dayLabel(date)}</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {daySlots.map((s) => {
                const full = s.booked >= s.capacity;
                return (
                  <div key={s.id} className={`rounded-xl border p-3 ${!s.isActive ? "opacity-50 border-black/10" : full ? "border-amber-300 bg-amber-50" : "border-black/10"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">
                        {s.start}–{s.end}
                      </span>
                      {isOwner && (
                        <button role="switch" aria-checked={s.isActive} aria-label={t("Aktiv", "Active")} className="admin-switch" onClick={() => patch(s.id, { isActive: !s.isActive })} />
                      )}
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-black/5 overflow-hidden">
                      <div className={`h-full ${full ? "bg-amber-500" : "bg-[#4f9d5f]"}`} style={{ width: `${Math.min(100, (s.booked / s.capacity) * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-black/60">
                      <span>
                        {s.booked} / {isOwner ? (
                          <input
                            type="number"
                            min={1}
                            defaultValue={s.capacity}
                            onBlur={(e) => Number(e.target.value) !== s.capacity && patch(s.id, { capacity: Number(e.target.value) })}
                            className="w-12 border border-black/10 rounded px-1"
                            aria-label={t("Kapazität", "Capacity")}
                          />
                        ) : (
                          s.capacity
                        )}{" "}
                        {t("gebucht", "booked")}
                      </span>
                      {isOwner && (
                        <button onClick={() => remove(s.id)} className="text-black/40 hover:text-red-600" aria-label={t("Löschen", "Delete")}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
