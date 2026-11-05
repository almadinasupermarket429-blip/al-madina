"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { Trash2, UserPlus } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type AdminAccount = { id: string; name: string; email: string; role: "OWNER" | "STAFF"; createdAt: string };

export default function TeamPage() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/admin/team")
      .then((res) => res.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []));
  }

  useEffect(load, []);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("Konto konnte nicht erstellt werden.", "Could not create the account."));
        setSubmitting(false);
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setRole("STAFF");
      load();
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  async function removeAccount(id: string) {
    if (!confirm(t("Dieses Admin-Konto entfernen? Der Zugriff wird sofort entzogen.", "Remove this admin account? They'll lose access immediately."))) return;
    const res = await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || t("Konto konnte nicht entfernt werden.", "Could not remove this account."));
      return;
    }
    load();
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-serif mb-2">{t("Team", "Team")}</h1>
      <p className="text-black/60 text-sm mb-6">
        {t(
          "Inhaber haben vollen Zugriff. Mitarbeiter können Bestellungen verwalten, sehen aber keine Analysen, können keine Produkte bearbeiten, Bewertungen moderieren oder das Team verwalten.",
          "Owners have full access. Staff can manage orders but can't see analytics, edit products, moderate reviews, or manage the team."
        )}
      </p>

      <div className="bg-white rounded-xl border border-black/5 p-5 mb-8">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <UserPlus size={16} /> {t("Admin-Konto hinzufügen", "Add an admin account")}
        </h2>
        <form onSubmit={addAccount} className="flex flex-wrap gap-2 items-start">
          <input required aria-label={t("Name", "Name")} placeholder={t("Name", "Name")} value={name} onChange={(e) => setName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]" />
          <input required type="email" aria-label="E-Mail" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]" />
          <input required type="password" aria-label={t("Passwort (mind. 8 Zeichen)", "Password (min. 8 chars)")} placeholder={t("Passwort (mind. 8 Zeichen)", "Password (min. 8 chars)")} value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]" />
          <select aria-label={t("Rolle", "Role")} value={role} onChange={(e) => setRole(e.target.value as "OWNER" | "STAFF")} className="border rounded-lg px-3 py-2 text-sm">
            <option value="STAFF">{t("Mitarbeiter", "Staff")}</option>
            <option value="OWNER">{t("Inhaber", "Owner")}</option>
          </select>
          <button disabled={submitting} className="bg-[#a12e3d] text-white rounded-lg px-4 py-2 text-sm font-medium">
            {submitting ? t("Wird hinzugefügt…", "Adding…") : t("Hinzufügen", "Add")}
          </button>
        </form>
        {error && <div className="text-sm text-[#a12e3d] mt-2">{error}</div>}
      </div>

      <div className="bg-white rounded-xl border border-black/5">
        {accounts === null && <p className="p-5 text-sm text-black/60">{t("Lädt…", "Loading…")}</p>}
        {accounts?.length === 0 && <p className="p-5 text-sm text-black/60">{t("Noch keine Konten — fügen Sie oben eines hinzu.", "No accounts yet — add one above.")}</p>}
        {accounts && accounts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-black/60 border-b border-black/5">
                  <th className="py-3 px-5">{t("Name", "Name")}</th>
                  <th className="py-3 px-5">Email</th>
                  <th className="py-3 px-5">{t("Rolle", "Role")}</th>
                  <th className="py-3 px-5" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-black/5 last:border-0">
                    <td className="py-3 px-5">{a.name}</td>
                    <td className="py-3 px-5">{a.email}</td>
                    <td className="py-3 px-5">
                      <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ${a.role === "OWNER" ? "bg-[#a12e3d]/10 text-[#a12e3d]" : "bg-black/5 text-black/60"}`}>
                        {a.role}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button onClick={() => removeAccount(a.id)} className="text-black/60 hover:text-[#a12e3d]" aria-label={t("Entfernen", "Remove")}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
