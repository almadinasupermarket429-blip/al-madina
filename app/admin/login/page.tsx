"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { GoogleLogo } from "@/app/components/GoogleLogo";

export default function AdminLoginPage() {
  const { t } = useLanguage();
  const [googleLogin, setGoogleLogin] = useState(false);
  useEffect(() => {
    fetch("/api/account/me")
      .then((r) => r.json())
      .then((d) => setGoogleLogin(Boolean(d.googleLogin)))
      .catch(() => {});
  }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("Anmeldung fehlgeschlagen.", "Login failed."));
        setLoading(false);
        return;
      }

      // Success! Force a hard redirect to ensure the browser sends the new auth cookie
      // to the Next.js middleware protecting the /admin routes.
      window.location.href = "/admin";
    } catch {
      setError(t("Server konnte nicht erreicht werden.", "Could not reach the server."));
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f7f3] px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-black/5 p-8">
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo.png" alt="Al-Madina" className="w-12 h-14 object-contain" />
          <div>
            <div className="font-serif text-lg font-medium">Al-Madina Admin</div>
            <div className="text-xs text-black/60">{t("Store-Verwaltungsportal", "Store management portal")}</div>
          </div>
        </div>

        <label htmlFor="admin-username" className="block text-xs font-semibold text-black/60 mb-1">{t("Benutzername", "Username")}</label>
        <input
          id="admin-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#a12e3d]"
          autoFocus
          required
        />

        <label htmlFor="admin-password" className="block text-xs font-semibold text-black/60 mb-1">{t("Passwort", "Password")}</label>
        <input
          id="admin-password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-5 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#a12e3d]"
          required
        />

        {error && <div className="mb-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <button
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-linear-to-br from-[#a12e3d] to-[#7a1a26] text-white font-semibold py-2.5 text-sm disabled:opacity-60"
        >
          <Lock size={15} /> {loading ? t("Anmeldung läuft…", "Signing in…") : t("Anmelden", "Sign in")}
        </button>

        {googleLogin && (
          <a href="/api/account/google?next=/admin" className="google-btn" style={{ marginTop: 12, borderRadius: 8, padding: "9px 16px" }}>
            <GoogleLogo /> {t("Mit Google anmelden", "Sign in with Google")}
          </a>
        )}

        <Link href="/" className="mt-5 flex items-center justify-center gap-2 text-xs text-black/40 hover:text-black/70">
          <ShoppingBag size={13} /> {t("Zurück zum Shop", "Back to storefront")}
        </Link>
      </form>
    </main>
  );
}
