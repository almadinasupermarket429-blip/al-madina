"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Undo2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { STORE } from "@/lib/store-info";

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 28, scrollMarginTop: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: 10 }}>{title}</h2>
      <div style={{ lineHeight: 1.8, color: "#3a423d", fontSize: 14 }}>{children}</div>
    </section>
  );
}

type Result = { outcome: "cancelled" | "recorded" | "already_cancelled"; receivedAt?: string };

export default function WiderrufPage() {
  const { t } = useLanguage();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get("order");
    if (order) {
      setOrderNumber(order);
      setTimeout(() => document.getElementById("widerrufen")?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email, name, message }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || t("Etwas ist schiefgelaufen.", "Something went wrong."));
      else setResult(data);
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  const address = `${STORE.name}, ${STORE.street}, ${STORE.postalCode} ${STORE.city}`;

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] py-12 px-4 md:px-8">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> {t("Zurück zum Shop", "Back to shop")}
        </Link>

        <div style={{ marginBottom: 4 }}>
          <span className="eyebrow">{t("Rechtliches", "Legal")}</span>
        </div>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>{t("Widerrufsbelehrung", "Right of withdrawal")}</h1>
        <p style={{ fontSize: 12, color: "rgba(24,32,27,.5)", marginBottom: 24 }}>
          {t(
            "Entwurf auf Grundlage der gesetzlichen Muster-Widerrufsbelehrung. Muss vor Veröffentlichung juristisch geprüft werden.",
            "Draft based on the statutory model withdrawal notice. Must be legally reviewed before going live."
          )}
        </p>

        <a href="#widerrufen" className="primary-btn" style={{ display: "inline-flex", marginBottom: 28 }}>
          <Undo2 size={16} /> {t("Vertrag hier widerrufen", "Withdraw from contract here")}
        </a>

        <Section title={t("Widerrufsrecht", "Right of withdrawal")}>
          <p style={{ marginBottom: 10 }}>
            {t(
              "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat.",
              "You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period is fourteen days from the day on which you, or a third party other than the carrier named by you, took possession of the goods."
            )}
          </p>
          <p style={{ marginBottom: 10 }}>
            {t(
              `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${address}, Telefon ${STORE.phoneDisplay}, E-Mail: [PLATZHALTER]) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Sie können den Vertrag auch über die Online-Funktion „Vertrag hier widerrufen“ auf dieser Seite widerrufen; wir bestätigen Ihnen den Eingang dann unverzüglich per E-Mail.`,
              `To exercise your right of withdrawal, you must inform us (${address}, phone ${STORE.phoneDisplay}, email: [PLACEHOLDER]) of your decision to withdraw from this contract by an unequivocal statement (e.g. a letter sent by post or an email). You may use the model withdrawal form below, but it is not obligatory. You can also withdraw using the “Withdraw from contract here” function on this page; we will then confirm receipt by email without delay.`
            )}
          </p>
          <p>
            {t(
              "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.",
              "To meet the withdrawal deadline, it is sufficient for you to send your notice of withdrawal before the withdrawal period has expired."
            )}
          </p>
        </Section>

        <Section title={t("Folgen des Widerrufs", "Effects of withdrawal")}>
          <p style={{ marginBottom: 10 }}>
            {t(
              "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Da Sie bar bezahlt haben, erstatten wir den Betrag in bar in unserem Laden oder auf Wunsch per Überweisung; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet. Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.",
              "If you withdraw from this contract, we shall reimburse all payments received from you, including delivery costs, without undue delay and in any event no later than fourteen days from the day on which we are informed of your decision to withdraw. As you paid in cash, we will refund the amount in cash at our shop or, if you prefer, by bank transfer; you will not incur any fees as a result of such reimbursement. We may withhold reimbursement until we have received the goods back or you have supplied evidence of having sent back the goods, whichever is the earliest."
            )}
          </p>
          <p style={{ marginBottom: 10 }}>
            {t(
              `Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden oder in unserem Laden (${STORE.street}, ${STORE.postalCode} ${STORE.city}) zurückzugeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von vierzehn Tagen absenden. Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.`,
              `You shall send back the goods or hand them back at our shop (${STORE.street}, ${STORE.postalCode} ${STORE.city}) without undue delay and in any event no later than fourteen days from the day on which you inform us of your withdrawal. The deadline is met if you send back the goods before the period of fourteen days has expired. You will bear the direct cost of returning the goods.`
            )}
          </p>
          <p>
            {t(
              "Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.",
              "You are only liable for any diminished value of the goods resulting from handling other than what is necessary to establish their nature, characteristics and functioning."
            )}
          </p>
        </Section>

        <Section title={t("Ausschluss des Widerrufsrechts", "Exceptions")}>
          <p style={{ marginBottom: 6 }}>{t("Das Widerrufsrecht besteht nicht bei Verträgen", "The right of withdrawal does not apply to contracts")}</p>
          <ul style={{ paddingLeft: 20, listStyle: "disc", display: "grid", gap: 6 }}>
            <li>
              {t(
                "zur Lieferung von Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde, z. B. frisches Fleisch, Obst, Gemüse, Backwaren und Milchprodukte (§ 312g Abs. 2 Nr. 2 BGB);",
                "for the supply of goods which are liable to deteriorate or expire rapidly, e.g. fresh meat, fruit, vegetables, baked goods and dairy products (§ 312g (2) no. 2 BGB);"
              )}
            </li>
            <li>
              {t(
                "zur Lieferung versiegelter Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde (§ 312g Abs. 2 Nr. 3 BGB).",
                "for the supply of sealed goods which are not suitable for return due to health protection or hygiene reasons, if they were unsealed after delivery (§ 312g (2) no. 3 BGB)."
              )}
            </li>
          </ul>
        </Section>

        <Section id="widerrufen" title={t("Vertrag hier widerrufen", "Withdraw from contract here")}>
          {result ? (
            <div style={{ background: "#eef6ef", borderRadius: 12, padding: 16 }}>
              <p style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700, marginBottom: 6 }}>
                <CheckCircle2 size={18} color="#2f6b3a" />
                {result.outcome === "already_cancelled"
                  ? t("Diese Bestellung ist bereits storniert.", "This order is already cancelled.")
                  : t("Ihr Widerruf ist eingegangen.", "Your withdrawal has been received.")}
              </p>
              {result.outcome === "cancelled" && (
                <p>{t("Ihre Bestellung hatte den Laden noch nicht verlassen und ist jetzt storniert. Sie müssen nichts weiter tun.", "Your order hadn't left the shop yet and is now cancelled. You don't need to do anything else.")}</p>
              )}
              {result.outcome === "recorded" && (
                <p>{t("Wir melden uns bei Ihnen, um Rückgabe und Erstattung zu besprechen.", "We'll get in touch to arrange the return and refund.")}</p>
              )}
              {result.outcome !== "already_cancelled" && (
                <p style={{ fontSize: 13, marginTop: 6 }}>
                  {t("Eine Eingangsbestätigung haben wir an Ihre E-Mail-Adresse gesendet.", "We've sent a confirmation of receipt to your email address.")}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="checkout-fields" style={{ gridTemplateColumns: "1fr" }}>
              <p style={{ fontSize: 13 }}>
                {t(
                  "Geben Sie die Bestellnummer und die E-Mail-Adresse Ihrer Bestellung ein. Hat die Bestellung den Laden noch nicht verlassen, wird sie sofort storniert.",
                  "Enter the order number and the email address used for the order. If the order hasn't left the shop yet, it is cancelled straight away."
                )}
              </p>
              <input required placeholder={t("Ihr Name", "Your name")} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              <input required placeholder={t("Bestellnummer (z. B. AM-20261021-A1B2C3)", "Order number (e.g. AM-20261021-A1B2C3)")} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
              <input required type="email" autoComplete="email" placeholder={t("E-Mail-Adresse der Bestellung", "Email address used for the order")} value={email} onChange={(e) => setEmail(e.target.value)} />
              <textarea
                placeholder={t("Welche Artikel? (optional, sonst gilt der Widerruf für die ganze Bestellung)", "Which items? (optional; otherwise the whole order)")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={1000}
              />
              {error && <div className="checkout-error">{error}</div>}
              <button className="primary-btn full" disabled={submitting}>
                {submitting ? t("Wird gesendet…", "Sending…") : t("Widerruf bestätigen", "Confirm withdrawal")}
              </button>
            </form>
          )}
        </Section>

        <Section title={t("Muster-Widerrufsformular", "Model withdrawal form")}>
          <div style={{ border: "1px dashed rgba(0,0,0,.2)", borderRadius: 12, padding: 16, fontSize: 13 }}>
            <p style={{ marginBottom: 8 }}>
              {t(
                "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
                "(If you want to withdraw from the contract, please fill in this form and send it back.)"
              )}
            </p>
            <p>{t(`An: ${address}, E-Mail: [PLATZHALTER]`, `To: ${address}, email: [PLACEHOLDER]`)}</p>
            <p>
              {t(
                "Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*):",
                "I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*):"
              )}
            </p>
            <p>{t("Bestellt am (*) / erhalten am (*):", "Ordered on (*) / received on (*):")}</p>
            <p>{t("Name des/der Verbraucher(s):", "Name of consumer(s):")}</p>
            <p>{t("Anschrift des/der Verbraucher(s):", "Address of consumer(s):")}</p>
            <p>{t("Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):", "Signature of consumer(s) (only if this form is notified on paper):")}</p>
            <p>{t("Datum:", "Date:")}</p>
            <p style={{ marginTop: 8, color: "rgba(24,32,27,.5)" }}>{t("(*) Unzutreffendes streichen.", "(*) Delete as appropriate.")}</p>
          </div>
        </Section>
      </div>
    </main>
  );
}
