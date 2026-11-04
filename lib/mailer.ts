import nodemailer from "nodemailer";
import { formatEuro } from "./format";
import { STORE, hoursSummary } from "./store-info";

// Customer emails go out in the customer's language (orders.language / users.language);
// emails to the shop stay German. Every email has a plain-text part as well as HTML.

type Lang = "de" | "en";
const L = (lang: Lang, de: string, en: string) => (lang === "en" ? en : de);

// A structural subset of lib/orders.ts's FullOrder — only the fields these
// templates actually use, so callers don't need to supply statusEvents etc.
type OrderItem = { name: string; sizeLabel: string | null; price: number; qty: number; deposit?: number };
type OrderWithItems = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: string;
  address: string | null;
  notes: string | null;
  subtotal: number;
  discount?: number;
  couponCode?: string | null;
  deliveryFee: number;
  depositTotal?: number;
  total: number;
  status: string;
  substitution?: string;
  cancelReason?: string | null;
  language?: Lang;
  slot?: { date: string; start: string; end: string } | null;
  items: OrderItem[];
};

const SITE_URL = () => process.env.NEXT_PUBLIC_SITE_URL || "";

const SUBSTITUTION_TEXT: Record<string, string> = {
  SUBSTITUTE: "Durch ähnlichen Artikel ersetzen",
  CALL: "Kunden anrufen",
  REMOVE: "Artikel weglassen",
};

// ---------------------------------------------------------------------------
// SMTP transport. Reads its settings from environment variables — see
// .env.example. SMTP_FROM is the sender; without it the SMTP login is used,
// which works for Gmail (the login is the mailbox). Providers like Brevo need
// SMTP_FROM set to a verified sender.
// ---------------------------------------------------------------------------
function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null; // Not configured yet — caller should log instead of throwing.
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
    auth: { user, pass },
  });
}

type SendResult = { sent: boolean; reason?: string };

/** Sends one email (HTML + plain text). Returns sent: false when SMTP isn't set up. */
async function send(to: string, subject: string, html: string, what: string): Promise<SendResult> {
  const transport = getTransport();
  if (!transport) {
    console.warn(`[mailer] SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) — skipping ${what}`);
    return { sent: false, reason: "SMTP not configured" };
  }
  await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text: htmlToText(html) });
  return { sent: true };
}

/** Plain-text version of an email body: keeps paragraphs, table rows and link targets. */
export function htmlToText(html: string): string {
  return html
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => `${label.replace(/<[^>]+>/g, "")} (${href})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h2|h3|tr|li|div|table|ul)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// These templates interpolate customer-supplied text (name, address, notes,
// item names) straight into HTML emails. Without escaping, a malicious order
// (e.g. name = "<img src=x onerror=...>" or a note containing a fake link)
// would inject arbitrary markup into the store owner's / customer's inbox.
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

const button = (href: string, label: string) =>
  `<p><a href="${escapeHtml(href)}" style="display:inline-block;margin:12px 0;background:#a12e3d;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;

const small = (text: string) => `<p style="font-size:12px;color:#6b6f6c">${text}</p>`;

function slotLine(order: OrderWithItems, lang: Lang) {
  if (!order.slot) return "";
  const day = new Date(`${order.slot.date}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-GB" : "de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  return `<p><b>${L(lang, "Zeitfenster", "Time slot")}:</b> ${escapeHtml(day)}, ${escapeHtml(order.slot.start)}–${escapeHtml(order.slot.end)}${L(lang, " Uhr", "")}</p>`;
}

function itemsTable(items: OrderItem[], lang: Lang) {
  const th = (text: string, align = "left") => `<th style="padding:6px 4px;text-align:${align}">${text}</th>`;
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <thead>
        <tr style="border-bottom:2px solid #a12e3d">
          ${th(L(lang, "Artikel", "Item"))}${th(L(lang, "Größe", "Size"))}${th(L(lang, "Menge", "Qty"), "center")}${th(L(lang, "Preis", "Price"), "right")}
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it) => `
          <tr style="border-bottom:1px solid #eee">
            <td style="padding:6px 4px">${escapeHtml(it.name)}</td>
            <td style="padding:6px 4px">${escapeHtml(it.sizeLabel ?? "-")}</td>
            <td style="padding:6px 4px;text-align:center">${it.qty}</td>
            <td style="padding:6px 4px;text-align:right">${formatEuro(it.price * it.qty, lang)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function totalsTable(order: OrderWithItems, lang: Lang) {
  const row = (label: string, value: string, style = "") => `<tr style="${style}"><td>${label}</td><td style="text-align:right">${value}</td></tr>`;
  const pickup = order.fulfillment === "PICKUP";
  return `
    <table style="width:100%;font-size:14px">
      ${row(L(lang, "Zwischensumme", "Subtotal"), formatEuro(order.subtotal, lang))}
      ${order.discount ? row(`${L(lang, "Rabatt", "Discount")}${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}`, `−${formatEuro(order.discount, lang)}`, "color:#2f6b3a") : ""}
      ${row(pickup ? L(lang, "Abholung", "Pickup") : L(lang, "Lieferung", "Delivery"), order.deliveryFee === 0 ? L(lang, "Kostenlos", "Free") : formatEuro(order.deliveryFee, lang))}
      ${order.depositTotal ? row(L(lang, "Pfand", "Deposit"), formatEuro(order.depositTotal, lang)) : ""}
      ${row(`<b>${L(lang, "Gesamt (bar, inkl. MwSt.)", "Total (cash, incl. VAT)")}</b>`, `<b>${formatEuro(order.total, lang)}</b>`, "font-size:16px")}
    </table>`;
}

function baseWrapper(title: string, bodyHtml: string, lang: Lang = "de") {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8f7f3;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
      <div style="background:linear-gradient(135deg,#a12e3d,#7a1a26);color:#fff;padding:20px 24px">
        <div style="font-size:20px;font-weight:bold">${STORE.name}</div>
        <div style="font-size:12px;opacity:.85;margin-top:2px">Halal Lebensmittel · ${STORE.city}</div>
      </div>
      <div style="padding:24px;color:#222">
        <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;background:#f8f7f3;color:#6b6f6c;font-size:11px">
        ${STORE.name}, ${STORE.street}, ${STORE.postalCode} ${STORE.city}<br/>
        ${L(lang, "Telefon", "Phone")} ${STORE.phoneDisplay}<br/>
        ${L(lang, `${hoursSummary("de")} Uhr, sonn- und feiertags geschlossen`, `${hoursSummary("en")}, closed Sundays and public holidays`)}<br/>
        ${L(lang, "Dies ist eine automatische Nachricht.", "This is an automatic message.")}
      </div>
    </div>
  </div>`;
}

function fulfillmentLine(order: OrderWithItems, lang: Lang) {
  return order.fulfillment === "PICKUP"
    ? `<p><b>${L(lang, "Abholung im Laden", "Pickup in store")}:</b> ${STORE.street}, ${STORE.postalCode} ${STORE.city}. ${L(
        lang,
        "Wir sagen Bescheid, sobald Ihre Bestellung abholbereit ist.",
        "We'll let you know as soon as your order is ready to collect."
      )}</p>`
    : `<p><b>${L(lang, "Lieferung an", "Delivery to")}:</b> ${escapeHtml(order.address ?? "")}</p>`;
}

/**
 * The withdrawal notice (Widerrufsbelehrung, Anlage 1 zu Art. 246a § 1 EGBGB) on a durable medium,
 * as the order confirmation must carry it (§ 312f Abs. 2 BGB), plus where the online form is.
 */
function withdrawalNotice(orderNumber: string, lang: Lang) {
  const formUrl = `${SITE_URL()}/widerruf?order=${encodeURIComponent(orderNumber)}`;
  const address = `${STORE.name}, ${STORE.street}, ${STORE.postalCode} ${STORE.city}, ${L(lang, "Telefon", "phone")} ${STORE.phoneDisplay}`;
  const body =
    lang === "en"
      ? `<p><b>Right of withdrawal.</b> You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period will expire after fourteen days from the day on which you acquire, or a third party other than the carrier and indicated by you acquires, physical possession of the goods. To exercise the right of withdrawal, you must inform us (${escapeHtml(address)}) of your decision to withdraw from this contract by an unequivocal statement (e.g. a letter sent by post, or our online form). You may use the model withdrawal form on our website, but it is not obligatory. To meet the withdrawal deadline, it is sufficient for you to send your communication before the withdrawal period has expired.</p>
         <p><b>Effects of withdrawal.</b> If you withdraw from this contract, we shall reimburse to you all payments received from you, including the costs of delivery (with the exception of the supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by us), without undue delay and in any event not later than fourteen days from the day on which we are informed about your decision to withdraw. We will carry out such reimbursement using the same means of payment as you used for the initial transaction (cash), unless you have expressly agreed otherwise. We may withhold reimbursement until we have received the goods back or you have supplied evidence of having sent back the goods, whichever is the earliest. You shall send back the goods or hand them over to us without undue delay and in any event not later than fourteen days from the day on which you communicate your withdrawal. You will have to bear the direct cost of returning the goods. You are only liable for any diminished value of the goods resulting from handling other than what is necessary to establish their nature, characteristics and functioning.</p>
         <p><b>Exceptions.</b> There is no right of withdrawal for goods that are liable to deteriorate or expire rapidly (e.g. fresh food), or for sealed goods which are not suitable for return due to health protection or hygiene reasons if they were unsealed after delivery (§ 312g (2) nos. 2 and 3 BGB).</p>`
      : `<p><b>Widerrufsrecht.</b> Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat. Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${escapeHtml(address)}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder unser Online-Formular) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das Muster-Widerrufsformular auf unserer Website verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.</p>
         <p><b>Folgen des Widerrufs.</b> Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben (Barzahlung), es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart. Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist. Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden oder zu übergeben. Sie tragen die unmittelbaren Kosten der Rücksendung der Waren. Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.</p>
         <p><b>Ausschluss.</b> Kein Widerrufsrecht besteht bei Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde (z. B. frische Lebensmittel), sowie bei versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde (§ 312g Abs. 2 Nr. 2 und 3 BGB).</p>`;
  return `
    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:12px;color:#444">
      <h3 style="font-size:14px;margin:0 0 8px">${L(lang, "Widerrufsbelehrung", "Withdrawal notice")}</h3>
      ${body}
      <p>${L(lang, "Widerruf online erklären", "Withdraw online")}: <a href="${escapeHtml(formUrl)}">${escapeHtml(formUrl)}</a></p>
    </div>`;
}

/** Email sent to the customer confirming their order. */
export async function sendCustomerConfirmationEmail(order: OrderWithItems): Promise<SendResult> {
  const lang: Lang = order.language ?? "de";
  const pickup = order.fulfillment === "PICKUP";
  const html = baseWrapper(
    L(lang, `Vielen Dank, ${escapeHtml(order.customerName)}!`, `Thank you, ${escapeHtml(order.customerName)}!`),
    `
    <p>${L(lang, "Wir haben Ihre Bestellung", "We have received your order")} <b>#${escapeHtml(order.orderNumber)}</b>${L(lang, " erhalten.", ".")}</p>
    ${fulfillmentLine(order, lang)}
    ${slotLine(order, lang)}
    ${itemsTable(order.items, lang)}
    ${totalsTable(order, lang)}
    <p style="margin-top:16px">${L(
      lang,
      `Sie zahlen <b>bar bei ${pickup ? "Abholung" : "Lieferung"}</b>. Bitte halten Sie nach Möglichkeit den passenden Betrag bereit.`,
      `You pay <b>in cash on ${pickup ? "pickup" : "delivery"}</b>. Please have the exact amount ready if you can.`
    )}</p>
    <p>${L(
      lang,
      `Wir schreiben Ihnen, sobald Ihre Bestellung ${pickup ? "abholbereit" : "unterwegs"} ist.`,
      `We'll email you as soon as your order is ${pickup ? "ready to collect" : "on its way"}.`
    )}</p>
    ${button(`${SITE_URL()}/account`, L(lang, "Bestellung ansehen", "View your order"))}
    ${small(L(lang, `Fragen? Rufen Sie uns an: ${STORE.phoneDisplay}`, `Questions? Call us: ${STORE.phoneDisplay}`))}
    ${withdrawalNotice(order.orderNumber, lang)}
    `,
    lang
  );
  return send(
    order.customerEmail,
    L(lang, `Ihre Bestellung #${order.orderNumber} bei ${STORE.name}`, `Your ${STORE.name} order #${order.orderNumber}`),
    html,
    `customer email for order ${order.orderNumber}`
  );
}

/**
 * Email sent to the store owner when a new order comes in. It deliberately leaves out the
 * customer's name, contact details, address and notes, so no personal data ends up in the
 * store's mailbox. The full order is in the admin portal.
 */
export async function sendStoreNotificationEmail(order: OrderWithItems): Promise<SendResult> {
  const storeEmail = process.env.STORE_NOTIFICATION_EMAIL;
  if (!storeEmail) {
    console.warn("[mailer] STORE_NOTIFICATION_EMAIL not set — skipping store email for order", order.orderNumber);
    return { sent: false, reason: "Store email not configured" };
  }
  const html = baseWrapper(
    `Neue Bestellung #${escapeHtml(order.orderNumber)}`,
    `
    <p><b>${order.fulfillment === "PICKUP" ? "Abholung im Laden" : "Lieferung"}</b>${order.language === "en" ? " (Kunde schreibt Englisch)" : ""}</p>
    ${slotLine(order, "de")}
    <p style="color:#666">Kundendaten, Adresse und Hinweise finden Sie im Admin-Portal.</p>
    ${order.substitution ? `<p><b>Falls nicht verfügbar:</b> ${escapeHtml(SUBSTITUTION_TEXT[order.substitution] ?? order.substitution)}</p>` : ""}
    ${order.discount ? `<p><b>Gutschein:</b> ${escapeHtml(order.couponCode ?? "")} (−${formatEuro(order.discount)})</p>` : ""}
    ${itemsTable(order.items, "de")}
    <p style="font-size:16px;font-weight:bold">Einzusammelnder Betrag (bar): ${formatEuro(order.total)}</p>
    ${button(`${SITE_URL()}/admin`, "Admin-Portal öffnen")}
    `
  );
  return send(storeEmail, `Neue Bestellung #${order.orderNumber}: ${formatEuro(order.total)} bar`, html, `store email for order ${order.orderNumber}`);
}

/** Email sent to the customer when their order status changes. */
export async function sendStatusUpdateEmail(order: OrderWithItems): Promise<SendResult> {
  if (!order.customerEmail) return { sent: false, reason: "Contact details removed" };
  const lang: Lang = order.language ?? "de";
  const pickup = order.fulfillment === "PICKUP";
  const statusText: Record<string, string> = {
    PACKED: pickup ? L(lang, "Ihre Bestellung ist abholbereit", "Your order is ready to collect") : L(lang, "Ihre Bestellung wurde gepackt", "Your order has been packed"),
    OUT_FOR_DELIVERY: L(lang, "Ihre Bestellung ist unterwegs", "Your order is on its way"),
    DELIVERED: pickup ? L(lang, "Ihre Bestellung wurde abgeholt", "Your order has been collected") : L(lang, "Ihre Bestellung wurde zugestellt", "Your order has been delivered"),
    CANCELLED: L(lang, "Ihre Bestellung wurde storniert", "Your order has been cancelled"),
  };
  const label = statusText[order.status];
  if (!label) return { sent: false, reason: "No email for this status" };

  const body =
    order.status === "CANCELLED"
      ? `<p>${L(lang, "Bestellung", "Order")} <b>#${escapeHtml(order.orderNumber)}</b> ${L(lang, "wurde storniert", "has been cancelled")}${
          order.cancelReason ? ` (${escapeHtml(order.cancelReason)})` : ""
        }. ${L(lang, "Es fällt keine Zahlung an.", "You don't need to pay anything.")}</p>`
      : `<p>${L(lang, "Bestellung", "Order")} <b>#${escapeHtml(order.orderNumber)}</b>: ${formatEuro(order.total, lang)} ${L(
          lang,
          `bar bei ${pickup ? "Abholung" : "Lieferung"}`,
          `in cash on ${pickup ? "pickup" : "delivery"}`
        )}.</p>${
          order.status === "PACKED" && pickup
            ? `<p>${L(lang, "Abholung", "Pickup")}: ${STORE.street}, ${STORE.postalCode} ${STORE.city}, ${L(lang, `${hoursSummary("de")} Uhr`, hoursSummary("en"))}</p>`
            : ""
        }`;
  const html = baseWrapper(
    label,
    `${body}
     ${button(`${SITE_URL()}/account`, L(lang, "Bestellung ansehen", "View your order"))}
     ${small(L(lang, `Fragen? Rufen Sie uns an: ${STORE.phoneDisplay}`, `Questions? Call us: ${STORE.phoneDisplay}`))}`,
    lang
  );
  return send(order.customerEmail, `${L(lang, "Bestellung", "Order")} #${order.orderNumber}: ${label}`, html, `status email for order ${order.orderNumber}`);
}

/** Email sent to the store owner when a product size drops to/below the low-stock threshold. */
export async function sendLowStockAlert(items: { productName: string; sizeLabel: string; stock: number }[]): Promise<SendResult> {
  const storeEmail = process.env.STORE_NOTIFICATION_EMAIL;
  if (items.length === 0) return { sent: false, reason: "Nothing to report" };
  if (!storeEmail) return { sent: false, reason: "Store email not configured" };
  const html = baseWrapper(
    "Niedriger Lagerbestand",
    `
    <p>Die folgenden Artikel gehen zur Neige:</p>
    <ul style="font-size:14px">
      ${items.map((i) => `<li><b>${escapeHtml(i.productName)}</b> (${escapeHtml(i.sizeLabel)}): noch ${i.stock}</li>`).join("")}
    </ul>
    ${button(`${SITE_URL()}/admin/products`, "Produkte verwalten")}
    `
  );
  return send(storeEmail, `Niedriger Bestand: ${items.map((i) => i.productName).join(", ")}`, html, "low-stock email");
}

/** Email sent on registration (and on resend) with the one-time code to verify the account's email. */
export async function sendVerificationEmail(email: string, name: string, code: string, lang: Lang = "de"): Promise<SendResult> {
  const html = baseWrapper(
    L(lang, "Bestätigen Sie Ihre E-Mail-Adresse", "Confirm your email address"),
    `
    <p>${L(lang, `Hallo ${escapeHtml(name)}, mit diesem Code bestätigen Sie Ihre E-Mail-Adresse:`, `Hello ${escapeHtml(name)}, use this code to confirm your email address:`)}</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;margin:20px 0;color:#a12e3d">${escapeHtml(code)}</p>
    ${small(L(lang, "Der Code ist 15 Minuten gültig. Erst nach der Bestätigung können Sie bestellen.", "The code is valid for 15 minutes. You can order once your email is confirmed."))}
    ${small(L(lang, "Falls Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.", "If you didn't create an account, you can ignore this email."))}
    `,
    lang
  );
  return send(email, L(lang, `Ihr Bestätigungscode: ${code}`, `Your confirmation code: ${code}`), html, "verification email");
}

/** Email with a one-time link to choose a new password. */
export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string, lang: Lang = "de"): Promise<SendResult> {
  const html = baseWrapper(
    L(lang, "Passwort zurücksetzen", "Reset your password"),
    `
    <p>${L(lang, `Hallo ${escapeHtml(name)}, Sie haben angefordert, Ihr Passwort zurückzusetzen.`, `Hello ${escapeHtml(name)}, you asked to reset your password.`)}</p>
    ${button(resetUrl, L(lang, "Neues Passwort festlegen", "Choose a new password"))}
    ${small(L(lang, "Der Link ist 60 Minuten gültig und funktioniert nur einmal.", "The link is valid for 60 minutes and works once."))}
    ${small(L(lang, "Falls Sie das nicht angefordert haben, ignorieren Sie diese E-Mail. Ihr Passwort bleibt unverändert.", "If you didn't ask for this, ignore this email. Your password stays the same."))}
    `,
    lang
  );
  const result = await send(email, L(lang, `Passwort zurücksetzen: ${STORE.name}`, `Reset your password: ${STORE.name}`), html, "password reset email");
  if (!result.sent && process.env.NODE_ENV !== "production") console.log(`[dev] password reset link for ${email}: ${resetUrl}`);
  return result;
}

/**
 * Sent when someone registers with an email that already has an account. The
 * register endpoint answers identically either way (so it can't be used to
 * find out who is a customer); this email is how the real owner learns of it.
 */
export async function sendAccountExistsEmail(email: string, name: string, loginUrl: string, resetUrl: string, lang: Lang = "de"): Promise<SendResult> {
  const html = baseWrapper(
    L(lang, "Sie haben bereits ein Konto", "You already have an account"),
    `
    <p>${L(
      lang,
      `Hallo ${escapeHtml(name)}, gerade wurde versucht, mit dieser E-Mail-Adresse ein neues Konto zu erstellen. Sie haben bereits eines.`,
      `Hello ${escapeHtml(name)}, someone just tried to create a new account with this email address. You already have one.`
    )}</p>
    ${button(loginUrl, L(lang, "Jetzt anmelden", "Log in"))}
    <p>${L(lang, "Passwort vergessen?", "Forgot your password?")} <a href="${escapeHtml(resetUrl)}">${L(lang, "Hier zurücksetzen", "Reset it here")}</a>.</p>
    ${small(L(lang, "Falls Sie das nicht waren, ignorieren Sie diese E-Mail. An Ihrem Konto wurde nichts geändert.", "If this wasn't you, ignore this email. Nothing about your account has changed."))}
    `,
    lang
  );
  return send(email, L(lang, `Sie haben bereits ein Konto: ${STORE.name}`, `You already have an account: ${STORE.name}`), html, "account-exists email");
}

/** "cancelled": the whole order was stopped before it left the shop. "recorded": the shop follows up. */
export type WithdrawalOutcome = "cancelled" | "recorded";

/**
 * Confirms receipt of a withdrawal (Widerruf) to the customer. The law requires this
 * confirmation on a durable medium without delay (§ 356a BGB), so it is sent for every withdrawal.
 */
export async function sendWithdrawalConfirmationEmail(
  order: OrderWithItems,
  outcome: WithdrawalOutcome,
  receivedAt: Date,
  details: { partial?: boolean; message?: string } = {}
): Promise<SendResult> {
  if (!order.customerEmail) return { sent: false, reason: "Contact details removed" };
  const lang: Lang = order.language ?? "de";
  const when = receivedAt.toLocaleString(lang === "en" ? "en-GB" : "de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "short" });
  const next =
    outcome === "cancelled"
      ? L(
          lang,
          "Ihre Bestellung hatte unseren Laden noch nicht verlassen und ist jetzt <b>storniert</b>. Sie müssen nichts weiter tun und nichts bezahlen.",
          "Your order hadn't left our shop yet and is now <b>cancelled</b>. You don't need to do or pay anything."
        )
      : L(
          lang,
          `${details.partial ? "Ihr Widerruf betrifft einzelne Artikel. " : ""}Wir melden uns bei Ihnen, um Rückgabe und Erstattung zu besprechen. Für schnell verderbliche Lebensmittel und nach der Lieferung geöffnete versiegelte Waren besteht kein Widerrufsrecht.`,
          `${details.partial ? "Your withdrawal covers some of the items. " : ""}We'll get in touch to arrange the return and refund. There is no right of withdrawal for perishable food or for sealed goods opened after delivery.`
        );
  const html = baseWrapper(
    L(lang, `Ihr Widerruf zu Bestellung #${escapeHtml(order.orderNumber)}`, `Your withdrawal for order #${escapeHtml(order.orderNumber)}`),
    `
    <p>${L(lang, `Hallo ${escapeHtml(order.customerName)},`, `Hello ${escapeHtml(order.customerName)},`)}</p>
    <p>${L(
      lang,
      `wir bestätigen den Eingang Ihres Widerrufs für die Bestellung <b>#${escapeHtml(order.orderNumber)}</b> am <b>${escapeHtml(when)} Uhr</b>.`,
      `we confirm that we received your withdrawal for order <b>#${escapeHtml(order.orderNumber)}</b> on <b>${escapeHtml(when)}</b>.`
    )}</p>
    ${details.message ? `<p><b>${L(lang, "Ihre Angaben", "Your note")}:</b> ${escapeHtml(details.message)}</p>` : ""}
    <p>${next}</p>
    ${small(L(lang, `Fragen? Rufen Sie uns an: ${STORE.phoneDisplay}`, `Questions? Call us: ${STORE.phoneDisplay}`))}
    `,
    lang
  );
  return send(
    order.customerEmail,
    L(lang, `Eingangsbestätigung Ihres Widerrufs: Bestellung #${order.orderNumber}`, `Withdrawal received: order #${order.orderNumber}`),
    html,
    `withdrawal confirmation for order ${order.orderNumber}`
  );
}

/** Tells the store a withdrawal came in. No customer details: those are in the admin portal. */
export async function sendStoreWithdrawalNotice(orderNumber: string, outcome: WithdrawalOutcome, partial = false): Promise<SendResult> {
  const storeEmail = process.env.STORE_NOTIFICATION_EMAIL;
  if (!storeEmail) return { sent: false, reason: "Store email not configured" };
  const what =
    outcome === "cancelled"
      ? "Die Bestellung war noch nicht unterwegs und wurde automatisch storniert. Bitte nicht ausliefern."
      : partial
        ? "Der Widerruf betrifft nur einzelne Artikel (siehe Hinweis an der Bestellung). Die Bestellung wurde nicht storniert. Bitte Kunden kontaktieren."
        : "Die Bestellung war bereits unterwegs oder ausgeliefert. Bitte Kunden kontaktieren (Rückgabe/Erstattung). Hinweis steht an der Bestellung im Admin-Portal.";
  const html = baseWrapper(`Widerruf zu Bestellung #${escapeHtml(orderNumber)}`, `<p>${what}</p>${button(`${SITE_URL()}/admin`, "Admin-Portal öffnen")}`);
  return send(storeEmail, `Widerruf zu Bestellung #${orderNumber}`, html, "withdrawal store notice");
}
