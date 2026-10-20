"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

/** "Delete my account" (GDPR Art. 17): asks for the password, explains what is kept and why. */
export function DeleteAccount({ t, onDeleted }: { t: (de: string, en: string) => string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("Das Konto konnte nicht gelöscht werden.", "Your account could not be deleted."));
        return;
      }
      onDeleted();
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="text-btn" style={{ fontSize: 12, color: "#8a918c", padding: 0 }} onClick={() => setOpen(true)}>
        <Trash2 size={13} /> {t("Konto löschen", "Delete account")}
      </button>
    );
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm" style={{ padding: 20, borderColor: "rgba(161,46,61,.3)" }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "#a12e3d" }}>
        <Trash2 size={18} /> {t("Konto endgültig löschen", "Permanently delete account")}
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "#4b544e", margin: "8px 0 12px" }}>
        {t(
          "Ihr Name, Ihre E-Mail-Adresse, Telefonnummer, Adressen, Wunschliste, Warenkorb und Bewertungen werden gelöscht. Frühere Bestellungen müssen wir aus steuerlichen Gründen 6–10 Jahre aufbewahren; sie sind danach nicht mehr mit einem Konto verbunden. Dies kann nicht rückgängig gemacht werden.",
          "Your name, email address, phone number, addresses, wishlist, cart and reviews will be deleted. We must keep past orders for 6–10 years for tax reasons; they will no longer be linked to an account. This cannot be undone."
        )}
      </p>
      <form onSubmit={submit} className="checkout-fields" style={{ marginBottom: 0 }}>
        <input
          required
          type="password"
          autoComplete="current-password"
          placeholder={t("Passwort zur Bestätigung", "Password to confirm")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="checkout-error">{error}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary-btn" disabled={busy}>
            {busy ? t("Wird gelöscht…", "Deleting…") : t("Konto löschen", "Delete account")}
          </button>
          <button type="button" className="text-btn" onClick={() => setOpen(false)}>
            {t("Abbrechen", "Cancel")}
          </button>
        </div>
      </form>
    </section>
  );
}
