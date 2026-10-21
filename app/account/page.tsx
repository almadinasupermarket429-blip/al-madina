"use client";

import { useEffect, useState } from "react";
import { sizedImage } from "@/lib/images";
import Link from "next/link";
import { DeleteAccount } from "@/app/components/DeleteAccount";
import { ArrowLeft, LogOut, Package, User as UserIcon, Heart, MapPin, RefreshCw, Plus, Trash2, ShieldCheck, MailWarning, MailCheck, KeyRound, Pencil, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Account = { id: string; name: string; email: string; phone: string | null; role: "OWNER" | "STAFF" | null; emailVerified: boolean };
type OrderItem = { id: string; name: string; sizeLabel: string | null; price: number; qty: number };
type Order = {
  id: string;
  orderNumber: string;
  fulfillment: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
};
type WishlistProduct = { id: string; name: string; slug: string; image: string | null; category: string | null };
type Address = { id: string; label: string; line1: string; city: string; postalCode: string; isDefault: boolean };

const STATUS_LABEL: Record<string, [string, string]> = {
  PLACED: ["Bestellt", "Placed"],
  PACKED: ["Gepackt", "Packed"],
  OUT_FOR_DELIVERY: ["Unterwegs", "Out for delivery"],
  DELIVERED: ["Zugestellt", "Delivered"],
  CANCELLED: ["Storniert", "Cancelled"],
};

const muted = { color: "rgba(24,32,27,.7)" };
const mutedLight = { color: "rgba(24,32,27,.7)" };

export default function AccountPage() {
  const { t } = useLanguage();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newLine1, setNewLine1] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [addressError, setAddressError] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [forgotMessage, setForgotMessage] = useState("");

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");
  // Set after sign-up: the account isn't logged in until the emailed code is entered.
  const [pendingEmail, setPendingEmail] = useState("");

  function loadAccount() {
    fetch("/api/account/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("Not logged in");
        const data = await res.json();
        setAccount(data.user || null);
      })
      .catch(() => setAccount(null));
  }

  useEffect(() => {
    loadAccount();
    if (new URLSearchParams(window.location.search).get("forgot") === "1") setMode("forgot");
  }, []);

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setForgotMessage("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || t("Etwas ist schiefgelaufen.", "Something went wrong."));
      else
        setForgotMessage(
          t(
            "Falls ein Konto mit dieser E-Mail existiert, haben wir Ihnen einen Link zum Zurücksetzen gesendet. Bitte prüfen Sie auch den Spam-Ordner.",
            "If an account exists for that email, we've sent a reset link. Please also check your spam folder."
          )
        );
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileMessage("");
    const body: Record<string, string> = { name: profileName, phone: profilePhone };
    if (newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }
    const res = await fetch("/api/account/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setProfileError(data.error || t("Speichern fehlgeschlagen.", "Couldn't save."));
      return;
    }
    setAccount(data.user);
    setCurrentPassword("");
    setNewPassword("");
    setEditingProfile(false);
    setProfileMessage(newPassword ? t("Profil und Passwort gespeichert.", "Profile and password saved.") : t("Profil gespeichert.", "Profile saved."));
  }

  async function cancelOrder(o: Order) {
    if (!confirm(t(`Bestellung #${o.orderNumber} wirklich stornieren?`, `Really cancel order #${o.orderNumber}?`))) return;
    const res = await fetch(`/api/account/orders/${o.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setOrders((cur) => cur.map((x) => (x.id === o.id ? { ...x, status: "CANCELLED" } : x)));
  }

  function loadAddresses() {
    fetch("/api/account/addresses")
      .then((res) => res.json())
      .then((data) => setAddresses(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    if (account) {
      fetch("/api/account/orders")
        .then((res) => res.json())
        .then((data) => setOrders(Array.isArray(data) ? data : []));
      fetch("/api/account/wishlist")
        .then((res) => res.json())
        .then((data) => setWishlist(Array.isArray(data) ? data : []));
      loadAddresses();
    }
  }, [account]);

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddressError("");
    if (!newLabel || !newLine1 || !newCity || !newPostalCode) return;
    const res = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newLabel,
        line1: newLine1,
        city: newCity,
        postalCode: newPostalCode,
        isDefault: addresses.length === 0,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAddressError(data.error || t("Adresse konnte nicht gespeichert werden.", "Couldn't save that address."));
      return;
    }
    setNewLabel("");
    setNewLine1("");
    setNewCity("");
    setNewPostalCode("");
    loadAddresses();
  }

  async function removeAddress(id: string) {
    await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    setAddresses((cur) => cur.filter((a) => a.id !== id));
  }

  async function removeWishlistItem(id: string) {
    await fetch(`/api/account/wishlist/${id}`, { method: "DELETE" });
    setWishlist((cur) => cur.filter((p) => p.id !== id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const endpoint = mode === "login" ? "/api/account/login" : "/api/account/register";
    const body = mode === "login" ? { email, password } : { name, email, password, phone };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("Etwas ist schiefgelaufen.", "Something went wrong."));
        setSubmitting(false);
        return;
      }
      if (data.pending) {
        setPendingEmail(data.email);
        setPassword("");
      } else setAccount(data);
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    setAccount(null);
    setOrders([]);
  }

  async function submitVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/account/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingEmail ? { code: verifyCode, email: pendingEmail } : { code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || t("Dieser Code konnte nicht bestätigt werden.", "Could not verify that code."));
        setVerifying(false);
        return;
      }
      setVerifyCode("");
      if (pendingEmail) {
        setPendingEmail("");
        setAccount(data);
      } else loadAccount();
    } catch {
      setVerifyError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setVerifying(false);
  }

  async function resendVerification() {
    setResendMessage("");
    setVerifyError("");
    const res = await fetch("/api/account/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingEmail ? { email: pendingEmail } : {}),
    });
    const data = await res.json();
    if (!res.ok) {
      setVerifyError(data.error || t("Der Code konnte nicht erneut gesendet werden.", "Could not resend the code."));
      return;
    }
    setResendMessage(t("Ein neuer Code wurde an Ihre E-Mail gesendet.", "A new code was sent to your email."));
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] py-10 px-4 md:px-8">
      <div className="w-full max-w-3xl mx-auto">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 32 }}>
          <ArrowLeft size={16} /> {t("Zurück zum Shop", "Back to shop")}
        </Link>

        {account === undefined && <p style={muted}>{t("Lädt…", "Loading…")}</p>}

        {account === null && (
          <div className="w-full max-w-md mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
            <span className="eyebrow" style={{ display: "block", marginBottom: 4 }}>
              {t("Konto", "Account")}
            </span>
            <h1 style={{ fontSize: 30, margin: "8px 0 20px" }}>
              {mode === "login" ? t("Anmelden", "Sign in") : mode === "register" ? t("Konto erstellen", "Create an account") : t("Passwort vergessen", "Forgot password")}
            </h1>

            <div className="size-row" style={{ margin: "0 0 20px" }}>
              <button
                type="button"
                className={mode === "login" ? "size-pill active" : "size-pill"}
                style={{ flex: 1, padding: "9px 0", fontSize: 12 }}
                onClick={() => setMode("login")}
              >
                {t("Anmelden", "Sign in")}
              </button>
              <button
                type="button"
                className={mode === "register" ? "size-pill active" : "size-pill"}
                style={{ flex: 1, padding: "9px 0", fontSize: 12 }}
                onClick={() => setMode("register")}
              >
                {t("Registrieren", "Register")}
              </button>
            </div>

            {pendingEmail ? (
              <form onSubmit={submitVerifyCode} className="checkout-fields">
                <p style={{ fontSize: 13, ...muted }}>
                  {t(
                    `Fast geschafft! Wir haben einen 6-stelligen Code an ${pendingEmail} gesendet. Geben Sie ihn hier ein, um Ihr Konto zu aktivieren. Haben Sie bereits ein Konto mit dieser Adresse, finden Sie stattdessen einen Anmelde-Link in Ihrem Postfach.`,
                    `Almost done! We sent a 6-digit code to ${pendingEmail}. Enter it here to activate your account. If you already have an account with this address, you'll find a sign-in link in your inbox instead.`
                  )}
                </p>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder={t("6-stelliger Code", "6-digit code")}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  style={{ letterSpacing: 4, fontSize: 16 }}
                />
                {verifyError && <div className="checkout-error">{verifyError}</div>}
                {resendMessage && <small style={{ color: "var(--green-text)" }}>{resendMessage}</small>}
                <button className="primary-btn full" disabled={verifying || verifyCode.length !== 6}>
                  {verifying ? t("Wird geprüft…", "Checking…") : t("Konto aktivieren", "Activate account")}
                </button>
                <button type="button" className="text-btn" style={{ justifyContent: "center", fontSize: 13 }} onClick={resendVerification} disabled={resendCooldown > 0}>
                  {resendCooldown > 0 ? t(`Code erneut senden (${resendCooldown}s)`, `Resend code (${resendCooldown}s)`) : t("Code erneut senden", "Resend code")}
                </button>
                <button type="button" className="text-btn" style={{ justifyContent: "center", fontSize: 13 }} onClick={() => { setPendingEmail(""); setVerifyCode(""); setVerifyError(""); setMode("login"); }}>
                  <ArrowLeft size={14} /> {t("Zurück zur Anmeldung", "Back to sign in")}
                </button>
              </form>
            ) : mode === "forgot" ? (
              <form onSubmit={submitForgot} className="checkout-fields">
                <p style={{ fontSize: 13, ...muted }}>
                  {t(
                    "Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link, mit dem Sie ein neues Passwort festlegen können.",
                    "Enter your email address and we'll send you a link to set a new password."
                  )}
                </p>
                <input required type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {error && <div className="checkout-error">{error}</div>}
                {forgotMessage && <small style={{ color: "var(--green-text)" }}>{forgotMessage}</small>}
                <button className="primary-btn full" disabled={submitting}>
                  {submitting ? t("Bitte warten…", "Please wait…") : t("Link senden", "Send link")}
                </button>
                <button type="button" className="text-btn" style={{ justifyContent: "center", fontSize: 13 }} onClick={() => setMode("login")}>
                  <ArrowLeft size={14} /> {t("Zurück zur Anmeldung", "Back to sign in")}
                </button>
              </form>
            ) : (
            <form onSubmit={submit} className="checkout-fields">
              {mode === "register" && (
                <input required placeholder={t("Vollständiger Name", "Full name")} value={name} onChange={(e) => setName(e.target.value)} />
              )}
              <input required type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {mode === "register" && (
                <input placeholder={t("Telefon (optional)", "Phone (optional)")} value={phone} onChange={(e) => setPhone(e.target.value)} />
              )}
              <input
                required
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder={mode === "register" ? t("Passwort (mind. 8 Zeichen)", "Password (min. 8 characters)") : t("Passwort", "Password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <div className="checkout-error">{error}</div>}
              {mode === "register" && (
                <p className="privacy-note">
                  {t("Wir verwenden Ihre Angaben, um Ihr Konto zu führen und Bestellungen abzuwickeln. Details in unserer ", "We use your details to run your account and handle your orders. Details in our ")}
                  <Link href="/datenschutz">{t("Datenschutzerklärung", "Privacy Policy")}</Link>.
                </p>
              )}
              <button className="primary-btn full" style={{ marginTop: 4 }} disabled={submitting}>
                {submitting ? t("Bitte warten…", "Please wait…") : mode === "login" ? t("Anmelden", "Sign in") : t("Konto erstellen", "Create account")}
              </button>
              {mode === "login" && (
                <button
                  type="button"
                  className="text-btn"
                  style={{ justifyContent: "center", fontSize: 13 }}
                  onClick={() => {
                    setError("");
                    setMode("forgot");
                  }}
                >
                  <KeyRound size={14} /> {t("Passwort vergessen?", "Forgot your password?")}
                </button>
              )}
            </form>
            )}
          </div>
        )}

        {account && (
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 24,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div className="icon-btn" style={{ width: 48, height: 48 }}>
                  <UserIcon size={22} />
                </div>
                <div>
                  <h1 style={{ fontSize: 24, margin: 0 }}>{account.name}</h1>
                  <small style={muted}>{account.email}</small>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {account.role && (
                  <Link href="/admin" className="primary-btn">
                    <ShieldCheck size={16} /> Admin
                  </Link>
                )}
                <button className="text-btn" onClick={logout} style={{ fontSize: 13 }}>
                  <LogOut size={16} /> {t("Abmelden", "Log out")}
                </button>
              </div>
            </div>

            {/* Profile */}
            <section className="bg-white rounded-xl border border-black/5 shadow-sm" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18 }}>
                  <UserIcon size={18} /> {t("Profil", "Profile")}
                </h2>
                {!editingProfile && (
                  <button
                    className="text-btn"
                    style={{ fontSize: 13, padding: 0 }}
                    onClick={() => {
                      setProfileName(account.name);
                      setProfilePhone(account.phone ?? "");
                      setProfileError("");
                      setProfileMessage("");
                      setEditingProfile(true);
                    }}
                  >
                    <Pencil size={14} /> {t("Bearbeiten", "Edit")}
                  </button>
                )}
              </div>
              {!editingProfile ? (
                <div style={{ fontSize: 14, marginTop: 10, display: "grid", gap: 4 }}>
                  <span>
                    <b>{t("Name", "Name")}:</b> {account.name}
                  </span>
                  <span>
                    <b>{t("Telefon", "Phone")}:</b> {account.phone || <span style={mutedLight}>{t("nicht angegeben", "not set")}</span>}
                  </span>
                  {profileMessage && <small style={{ color: "var(--green-text)" }}>{profileMessage}</small>}
                </div>
              ) : (
                <form onSubmit={saveProfile} className="checkout-fields" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
                  <input required placeholder={t("Vollständiger Name", "Full name")} value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                  <input placeholder={t("Telefon", "Phone")} value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
                  <small style={{ gridColumn: "1 / -1", ...muted }}>{t("Passwort ändern (optional)", "Change password (optional)")}</small>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder={t("Aktuelles Passwort", "Current password")}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder={t("Neues Passwort (mind. 8)", "New password (min. 8)")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  {profileError && (
                    <div className="checkout-error" style={{ gridColumn: "1 / -1" }}>
                      {profileError}
                    </div>
                  )}
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                    <button className="primary-btn">{t("Speichern", "Save")}</button>
                    <button type="button" className="text-btn" onClick={() => setEditingProfile(false)}>
                      {t("Abbrechen", "Cancel")}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <DeleteAccount
              t={t}
              onDeleted={() => {
                setAccount(null);
                setOrders([]);
                window.location.href = "/";
              }}
            />

            {/* Email verification */}
            {account.emailVerified ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--green-text)" }}>
                <MailCheck size={16} /> {t("E-Mail bestätigt", "Email verified")}
              </div>
            ) : (
              <div
                className="bg-white rounded-xl border border-black/5 shadow-sm"
                style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                  <MailWarning size={18} color="#c79a3a" /> {t("Bestätigen Sie Ihre E-Mail, um Bestellungen aufzugeben", "Confirm your email to place orders")}
                </div>
                <p style={{ fontSize: 13, ...muted }}>
                  {t(
                    `Wir haben einen 6-stelligen Code an ${account.email} gesendet. Geben Sie ihn unten ein — Sie können ohne Bestätigung stöbern und Artikel merken, benötigen sie aber zum Bestellen.`,
                    `We sent a 6-digit code to ${account.email}. Enter it below — you can browse and save items to your basket without this, but you'll need to confirm your email before checking out.`
                  )}
                </p>
                <form onSubmit={submitVerifyCode} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t("6-stelliger Code", "6-digit code")}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: "9px 13px",
                      fontSize: 16,
                      letterSpacing: 4,
                      width: 140,
                    }}
                  />
                  <button className="primary-btn" disabled={verifying || verifyCode.length !== 6}>
                    {verifying ? t("Wird geprüft…", "Checking…") : t("Bestätigen", "Verify")}
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={resendVerification}
                    disabled={resendCooldown > 0}
                    style={{ fontSize: 13 }}
                  >
                    {resendCooldown > 0 ? t(`Code erneut senden (${resendCooldown}s)`, `Resend code (${resendCooldown}s)`) : t("Code erneut senden", "Resend code")}
                  </button>
                </form>
                {verifyError && <div className="checkout-error">{verifyError}</div>}
                {resendMessage && <small style={{ color: "var(--green-text)" }}>{resendMessage}</small>}
              </div>
            )}

            {/* Orders */}
            <section>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, marginBottom: 16 }}>
                <Package size={18} /> {t("Bestellverlauf", "Order history")}
              </h2>
              {orders.length === 0 ? (
                <p style={muted}>{t("Noch keine Bestellungen — Ihre Bestellungen erscheinen hier.", "No orders yet — your placed orders will show up here.")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white rounded-xl border border-black/5 shadow-sm"
                      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Link href={`/account/orders/${o.id}`} style={{ fontWeight: 700, textDecoration: "underline" }}>
                          #{o.orderNumber}
                        </Link>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            background: "rgba(161,46,61,.08)",
                            color: "var(--green-text)",
                            padding: "5px 12px",
                            borderRadius: 999,
                          }}
                        >
                          {STATUS_LABEL[o.status] ? t(STATUS_LABEL[o.status][0], STATUS_LABEL[o.status][1]) : o.status}
                        </span>
                      </div>
                      <small style={muted}>
                        {new Date(o.createdAt).toLocaleDateString()} · {o.fulfillment === "DELIVERY" ? t("Lieferung", "Delivery") : t("Abholung", "Pickup")}
                      </small>
                      <ul style={{ fontSize: 13, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {o.items.map((it) => (
                          <li key={it.id}>
                            {it.qty}× {it.name} {it.sizeLabel ? `(${it.sizeLabel})` : ""}
                          </li>
                        ))}
                      </ul>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontWeight: 700,
                          borderTop: "1px solid var(--line)",
                          paddingTop: 12,
                          marginTop: 8,
                        }}
                      >
                        <span>
                          {t("Gesamt (bar)", "Total (cash)")} · €{o.total.toFixed(2)}
                        </span>
                        <span style={{ display: "flex", gap: 14 }}>
                          {o.status === "PLACED" && (
                            <button className="text-btn" style={{ fontSize: 13, padding: 0, color: "#b3261e" }} onClick={() => cancelOrder(o)}>
                              <XCircle size={14} /> {t("Stornieren", "Cancel")}
                            </button>
                          )}
                          <Link href={`/?reorder=${o.id}`} className="text-btn" style={{ fontSize: 13, padding: 0 }}>
                            <RefreshCw size={14} /> {t("Erneut bestellen", "Reorder")}
                          </Link>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Wishlist */}
            <section>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, marginBottom: 16 }}>
                <Heart size={18} /> {t("Wunschliste", "Wishlist")}
              </h2>
              {wishlist.length === 0 ? (
                <p style={muted}>{t("Artikel, die Sie mit dem Herz-Symbol merken, erscheinen hier.", "Items you save with the heart icon on the shop page will show up here.")}</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 16 }}>
                  {wishlist.map((p) => (
                    <div key={p.id} style={{ position: "relative" }}>
                      <Link href={`/products/${p.slug}`} style={{ display: "block" }}>
                        {p.image ? (
                          <img
                            src={sizedImage(p.image, 200)}
                            alt={p.name}
                            style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 14 }}
                            className="border border-black/5"
                          />
                        ) : (
                          <div
                            style={{ width: "100%", aspectRatio: "1/1", borderRadius: 14, background: "#eee" }}
                          />
                        )}
                        <span style={{ display: "block", marginTop: 8, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                      </Link>
                      <button
                        onClick={() => removeWishlistItem(p.id)}
                        aria-label={t("Entfernen", "Remove")}
                        className="heart liked"
                        style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Addresses */}
            <section>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, marginBottom: 16 }}>
                <MapPin size={18} /> {t("Gespeicherte Adressen", "Saved addresses")}
              </h2>
              {addresses.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
                  {addresses.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white rounded-xl border border-black/5 shadow-sm"
                      style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
                    >
                      <div>
                        <span style={{ fontWeight: 700 }}>{a.label}</span>
                        {a.isDefault && <small style={{ ...mutedLight, marginLeft: 6 }}>({t("Standard", "default")})</small>}
                        <p style={{ fontSize: 13, marginTop: 4, ...muted }}>
                          {a.line1}, {a.postalCode} {a.city}
                        </p>
                      </div>
                      <button onClick={() => removeAddress(a.id)} className="heart" style={{ position: "static", width: 30, height: 30 }} aria-label={t("Adresse entfernen", "Remove address")}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={addAddress}
                className="checkout-fields bg-white rounded-xl border border-black/5 shadow-sm"
                style={{ padding: 16, gridTemplateColumns: "1fr 1fr", maxWidth: 560 }}
              >
                <input
                  placeholder={t("Bezeichnung (z. B. Zuhause)", "Label (e.g. Home)")}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  style={{ gridColumn: "1 / -1" }}
                />
                <input
                  placeholder={t("Straße und Hausnummer", "Street and house number")}
                  value={newLine1}
                  onChange={(e) => setNewLine1(e.target.value)}
                  style={{ gridColumn: "1 / -1" }}
                />
                <input placeholder={t("Postleitzahl", "Postal code")} value={newPostalCode} onChange={(e) => setNewPostalCode(e.target.value)} />
                <input placeholder={t("Stadt", "City")} value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                {addressError && (
                  <div className="checkout-error" style={{ gridColumn: "1 / -1" }}>
                    {addressError}
                  </div>
                )}
                <button className="primary-btn" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                  <Plus size={16} /> {t("Adresse hinzufügen", "Add address")}
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
