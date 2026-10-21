"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

function ResetPasswordForm() {
  const { t } = useLanguage();
  const token = useSearchParams().get("token") ?? "";
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setValid(false);
      return;
    }
    fetch(`/api/account/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => setValid(Boolean(data.valid)))
      .catch(() => setValid(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("Die Passwörter stimmen nicht überein.", "The passwords don't match."));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || t("Etwas ist schiefgelaufen.", "Something went wrong."));
      else setDone(true);
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
      <span className="eyebrow" style={{ display: "block", marginBottom: 4 }}>
        {t("Konto", "Account")}
      </span>
      <h1 style={{ fontSize: 30, margin: "8px 0 20px" }}>{t("Neues Passwort", "New password")}</h1>

      {valid === null && <p>{t("Link wird geprüft…", "Checking link…")}</p>}
      {valid === false && !done && (
        <>
          <div className="checkout-error">{t("Dieser Link ist ungültig oder abgelaufen.", "This link is invalid or has expired.")}</div>
          <Link href="/account?forgot=1" className="primary-btn full" style={{ marginTop: 16, justifyContent: "center" }}>
            {t("Neuen Link anfordern", "Request a new link")}
          </Link>
        </>
      )}
      {done && (
        <>
          <p style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--green-text)" }}>
            <Check size={18} /> {t("Ihr Passwort wurde geändert.", "Your password has been changed.")}
          </p>
          <Link href="/account" className="primary-btn full" style={{ marginTop: 16, justifyContent: "center" }}>
            {t("Jetzt anmelden", "Sign in now")}
          </Link>
        </>
      )}
      {valid && !done && (
        <form onSubmit={submit} className="checkout-fields">
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder={t("Neues Passwort (mind. 8 Zeichen)", "New password (min. 8 characters)")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            required
            type="password"
            autoComplete="new-password"
            placeholder={t("Passwort wiederholen", "Repeat password")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <div className="checkout-error">{error}</div>}
          <button className="primary-btn full" disabled={submitting}>
            {submitting ? t("Bitte warten…", "Please wait…") : t("Passwort speichern", "Save password")}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] py-10 px-4 md:px-8">
      <div className="w-full max-w-3xl mx-auto">
        <Link href="/account" className="text-btn" style={{ display: "inline-flex", marginBottom: 32 }}>
          <ArrowLeft size={16} /> {t("Zurück zur Anmeldung", "Back to sign in")}
        </Link>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
