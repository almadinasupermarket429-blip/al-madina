"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ClipboardList, LogOut, Package, ShoppingBag, Volume2, VolumeX, BarChart3, Menu, X, Settings, Ticket, CalendarClock, Users, MessageSquare, Tags, UserCog } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type AdminMe = { username: string; role: "OWNER" | "STAFF"; adminId: string | null };

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [soundOn, setSoundOn] = useState(false);
  const [flash, setFlash] = useState(false);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundOnRef = useRef(false);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((data) => setMe(data.admin));
  }, []);

  // Close the mobile nav drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const saved = localStorage.getItem("almadina_admin_sound");
    if (saved === "on") {
      soundOnRef.current = true;
      setSoundOn(true);
    }
  }, []);

  // Live connection to the order stream — plays the chime the instant a new order lands,
  // no matter which admin page you're on.
  useEffect(() => {
    const source = new EventSource("/api/orders/stream");
    source.addEventListener("order", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.type === "new_order") {
          setFlash(true);
          setTimeout(() => setFlash(false), 4000);
          if (soundOnRef.current && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
          window.dispatchEvent(new CustomEvent("almadina:new-order", { detail: data }));
        } else if (data.type === "order_updated") {
          window.dispatchEvent(new CustomEvent("almadina:order-updated", { detail: data }));
        }
      } catch {
        /* ignore malformed event */
      }
    });
    return () => source.close();
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    soundOnRef.current = next;
    localStorage.setItem("almadina_admin_sound", next ? "on" : "off");
    if (next && audioRef.current) {
      // Unlock autoplay: browsers require a real user gesture before audio can play.
      // This click IS that gesture, so we play+immediately allow future auto-plays.
      audioRef.current.play().then(() => {
        audioRef.current!.pause();
        audioRef.current!.currentTime = 0;
      }).catch(() => {});
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const isOwner = me?.role === "OWNER";
  const navItems = [
    { href: "/admin", label: t("Bestellungen", "Orders"), icon: ClipboardList },
    { href: "/admin/slots", label: t("Zeitfenster", "Time slots"), icon: CalendarClock },
    ...(isOwner
      ? [
          { href: "/admin/products", label: t("Produkte & Lager", "Products & stock"), icon: Package },
          { href: "/admin/categories", label: t("Kategorien", "Categories"), icon: Tags },
          { href: "/admin/coupons", label: t("Gutscheine", "Coupons"), icon: Ticket },
          { href: "/admin/customers", label: t("Kunden", "Customers"), icon: Users },
          { href: "/admin/reviews", label: t("Bewertungen", "Reviews"), icon: MessageSquare },
          { href: "/admin/analytics", label: t("Analyse", "Analytics"), icon: BarChart3 },
          { href: "/admin/team", label: t("Team", "Team"), icon: UserCog },
          { href: "/admin/settings", label: t("Einstellungen", "Settings"), icon: Settings },
        ]
      : []),
  ];

  return (
    // translate="no": the admin has its own DE/EN switch, and browser translation rewriting
    // live-updating text makes React crash ("insertBefore ... not a child of this node").
    <div className="min-h-screen bg-[#f4f3ee] lg:flex" translate="no">
      <audio ref={audioRef} src="/notification.wav" preload="auto" />
      {flash && (
        <div className="fixed inset-0 pointer-events-none z-[999] ring-8 ring-[#a12e3d]/40 animate-pulse" />
      )}

      {/* Mobile top bar — the sidebar below becomes an off-canvas drawer under lg */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-black/5 px-4 py-3 sticky top-0 z-40">
        <a href="/admin" className="flex items-center gap-2">
          <img src="/logo.png" alt="Al-Madina" className="w-8 h-10 object-contain" />
          <div className="font-serif text-base font-medium leading-tight">Al-Madina Admin</div>
        </a>
        <button
          onClick={() => setNavOpen(true)}
          aria-label={t("Menü öffnen", "Open menu")}
          className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center"
        >
          <Menu size={18} />
        </button>
      </div>

      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setNavOpen(false)}>
          <aside
            className="w-72 max-w-[85vw] h-full bg-white p-5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <a href="/admin" className="flex items-center gap-2">
                <img src="/logo.png" alt="Al-Madina" className="w-10 h-12 object-contain" />
                <div>
                  <div className="font-serif text-base font-medium leading-tight">Al-Madina</div>
                  <div className="text-[10px] uppercase tracking-wider text-black/40">Admin</div>
                </div>
              </a>
              <button
                onClick={() => setNavOpen(false)}
                aria-label={t("Menü schließen", "Close menu")}
                className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <AdminNavContents
              me={me}
              isOwner={isOwner}
              navItems={navItems}
              pathname={pathname}
              soundOn={soundOn}
              toggleSound={toggleSound}
              handleLogout={handleLogout}
              language={language}
              setLanguage={setLanguage}
              t={t}
            />
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-60 shrink-0 bg-white border-r border-black/5 flex-col p-5 sticky top-0 h-screen">
        <a href="/admin" className="flex items-center gap-2 mb-8">
          <img src="/logo.png" alt="Al-Madina" className="w-10 h-12 object-contain" />
          <div>
            <div className="font-serif text-base font-medium leading-tight">Al-Madina</div>
            <div className="text-[10px] uppercase tracking-wider text-black/40">Admin</div>
          </div>
        </a>

        <AdminNavContents
          me={me}
          isOwner={isOwner}
          navItems={navItems}
          pathname={pathname}
          soundOn={soundOn}
          toggleSound={toggleSound}
          handleLogout={handleLogout}
          language={language}
          setLanguage={setLanguage}
          t={t}
        />
      </aside>

      <main className="flex-1 p-4 lg:p-8 max-w-[1400px] overflow-x-hidden">{children}</main>
    </div>
  );
}

function AdminNavContents({
  me,
  isOwner,
  navItems,
  pathname,
  soundOn,
  toggleSound,
  handleLogout,
  language,
  setLanguage,
  t,
}: {
  me: AdminMe | null;
  isOwner: boolean;
  navItems: { href: string; label: string; icon: typeof ClipboardList }[];
  pathname: string;
  soundOn: boolean;
  toggleSound: () => void;
  handleLogout: () => void;
  language: "de" | "en";
  setLanguage: (lang: "de" | "en") => void;
  t: (de: string, en: string) => string;
}) {
  return (
    <>
      {me && (
        <div className="mb-4 px-1">
          <div className="text-sm font-medium truncate">{me.username}</div>
          <span
            className={`inline-block text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 mt-1 ${
              isOwner ? "bg-[#a12e3d]/10 text-[#a12e3d]" : "bg-black/5 text-black/50"
            }`}
          >
            {me.role}
          </span>
        </div>
      )}

      <nav className="flex flex-col gap-1 overflow-y-auto min-h-0">
        {navItems.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              pathname === href ? "bg-[#a12e3d] text-white" : "text-black/70 hover:bg-black/5"
            }`}
          >
            <Icon size={16} /> {label}
          </a>
        ))}
      </nav>

      <div className="mt-auto pt-4 flex flex-col gap-2">
        <button
          onClick={() => setLanguage(language === "de" ? "en" : "de")}
          className="flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium border border-black/10 text-black/60"
        >
          {language === "de" ? "English" : "Deutsch"}
        </button>
        <button
          onClick={toggleSound}
          className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium border ${
            soundOn ? "border-[#4f9d5f] text-[#2f6b3a] bg-[#4f9d5f]/10" : "border-black/10 text-black/60"
          }`}
        >
          {/* Icon and text each sit in their own stable <span>: browser translation (e.g. Chrome
              translating this German page) wraps bare text nodes in <font>, and React then crashes
              with "insertBefore ... not a child of this node" when it swaps the icon next to them. */}
          <span className="flex shrink-0">{soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}</span>
          <span>
            {soundOn ? t("Bestellton: AN", "New-order sound: ON") : t("Bestellton aktivieren", "Enable order sound")}
          </span>
        </button>
        <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-black/50 hover:bg-black/5">
          <ShoppingBag size={16} /> {t("Shop ansehen", "View storefront")}
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-black/50 hover:bg-black/5">
          <LogOut size={16} /> {t("Abmelden", "Log out")}
        </button>
      </div>
    </>
  );
}
