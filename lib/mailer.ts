import nodemailer from "nodemailer";
import { STORE } from "./store-info";

// A structural subset of lib/orders.ts's FullOrder — only the fields these
// templates actually use, so callers don't need to supply statusEvents etc.
type OrderItem = { name: string; sizeLabel: string | null; price: number; qty: number };
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
  total: number;
  status: string;
  substitution?: string;
  cancelReason?: string | null;
  slot?: { date: string; start: string; end: string } | null;
  items: OrderItem[];
};

const SUBSTITUTION_TEXT: Record<string, string> = {
  SUBSTITUTE: "Durch ähnlichen Artikel ersetzen",
  CALL: "Kunden anrufen",
  REMOVE: "Artikel weglassen",
};

function slotLine(order: OrderWithItems) {
  if (!order.slot) return "";
  const day = new Date(`${order.slot.date}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  return `<p><b>Zeitfenster:</b> ${escapeHtml(day)}, ${escapeHtml(order.slot.start)}–${escapeHtml(order.slot.end)} Uhr</p>`;
}

function discountRow(order: OrderWithItems) {
  if (!order.discount) return "";
  return `<tr style="color:#2f6b3a"><td>Rabatt${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</td><td style="text-align:right">−${money(order.discount)}</td></tr>`;
}

// ---------------------------------------------------------------------------
// SMTP transport. Reads its settings from environment variables — see
// .env.example for exactly which ones to fill in and where to get them
// (Gmail App Password, Resend, Brevo, SendGrid, Mailgun, or your host's SMTP).
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

function money(n: number) {
  return `€${n.toFixed(2)}`;
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

function itemsTable(items: OrderItem[]) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <thead>
        <tr style="text-align:left;border-bottom:2px solid #a12e3d">
          <th style="padding:6px 4px">Artikel</th>
          <th style="padding:6px 4px">Größe</th>
          <th style="padding:6px 4px;text-align:center">Menge</th>
          <th style="padding:6px 4px;text-align:right">Preis</th>
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
            <td style="padding:6px 4px;text-align:right">${money(it.price * it.qty)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function baseWrapper(title: string, bodyHtml: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8f7f3;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
      <div style="background:linear-gradient(135deg,#a12e3d,#7a1a26);color:#fff;padding:20px 24px">
        <div style="font-size:20px;font-weight:bold;letter-spacing:-0.02em">Al-Madina Markt</div>
        <div style="font-size:12px;opacity:.85;margin-top:2px">Halal Lebensmittel · Schweinfurt</div>
      </div>
      <div style="padding:24px;color:#222">
        <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;background:#f8f7f3;color:#999;font-size:11px">
        ${STORE.name} · ${STORE.street}, ${STORE.postalCode} ${STORE.city} · Tel. ${STORE.phoneDisplay}<br/>
        Mo–Sa 07:00–20:00 Uhr · Dies ist eine automatische Nachricht.
      </div>
    </div>
  </div>`;
}

function fulfillmentLine(order: OrderWithItems) {
  return order.fulfillment === "PICKUP"
    ? `<p><b>Abholung im Laden</b> — wir packen Ihre Bestellung, sie ist bei Al-Madina Markt zur Abholung bereit.</p>`
    : `<p><b>Lieferung nach Hause</b> an: ${escapeHtml(order.address ?? "")}</p>`;
}

/** Email sent to the customer confirming their order. */
export async function sendCustomerConfirmationEmail(order: OrderWithItems) {
  const transport = getTransport();
  const html = baseWrapper(
    `Vielen Dank, ${escapeHtml(order.customerName)}!`,
    `
    <p>Wir haben Ihre Bestellung <b>#${escapeHtml(order.orderNumber)}</b> erhalten.</p>
    ${fulfillmentLine(order)}
    ${slotLine(order)}
    ${itemsTable(order.items)}
    <table style="width:100%;font-size:14px">
      <tr><td>Zwischensumme</td><td style="text-align:right">${money(order.subtotal)}</td></tr>
      ${discountRow(order)}
      <tr><td>${order.fulfillment === "PICKUP" ? "Abholung" : "Lieferung"}</td><td style="text-align:right">${
      order.deliveryFee === 0 ? "Kostenlos" : money(order.deliveryFee)
    }</td></tr>
      <tr style="font-weight:bold;font-size:16px"><td style="padding-top:8px">Gesamt (bar)</td><td style="text-align:right;padding-top:8px">${money(
        order.total
      )}</td></tr>
    </table>
    <p style="margin-top:16px">Die Zahlung erfolgt <b>bar bei ${
      order.fulfillment === "PICKUP" ? "Abholung" : "Lieferung"
    }</b> — bitte halten Sie nach Möglichkeit den passenden Betrag bereit.</p>
    <p>Wir informieren Sie, sobald Ihre Bestellung von „gepackt" zu „${
      order.fulfillment === "PICKUP" ? "abholbereit" : "unterwegs"
    }" wechselt.</p>
    `
  );

  if (!transport) {
    console.warn("[mailer] SMTP not configured — skipping customer email for order", order.orderNumber);
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: order.customerEmail,
    subject: `Ihre Al-Madina Markt Bestellung #${order.orderNumber}`,
    html,
  });
  return { sent: true };
}

/**
 * Email sent to the store owner when a new order comes in. It deliberately leaves out the
 * customer's name, contact details, address and notes, so no personal data ends up in the
 * store's mailbox. The full order is in the admin portal.
 */
export async function sendStoreNotificationEmail(order: OrderWithItems) {
  const transport = getTransport();
  const storeEmail = process.env.STORE_NOTIFICATION_EMAIL;
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin`;

  const html = baseWrapper(
    `Neue Bestellung #${escapeHtml(order.orderNumber)}`,
    `
    <p><b>${order.fulfillment === "PICKUP" ? "Abholung im Laden" : "Lieferung"}</b></p>
    ${slotLine(order)}
    <p style="color:#666">Kundendaten, Adresse und Hinweise finden Sie im Admin-Portal.</p>
    ${order.substitution ? `<p><b>Falls nicht verfügbar:</b> ${escapeHtml(SUBSTITUTION_TEXT[order.substitution] ?? order.substitution)}</p>` : ""}
    ${order.discount ? `<p><b>Gutschein:</b> ${escapeHtml(order.couponCode ?? "")} (−${money(order.discount)})</p>` : ""}
    ${itemsTable(order.items)}
    <p style="font-size:16px;font-weight:bold">Einzusammelnder Betrag (bar): ${money(order.total)}</p>
    <p><a href="${adminUrl}" style="display:inline-block;margin-top:12px;background:#a12e3d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Admin-Portal öffnen</a></p>
    `
  );

  if (!transport || !storeEmail) {
    console.warn("[mailer] SMTP or STORE_NOTIFICATION_EMAIL not configured — skipping store email for order", order.orderNumber);
    return { sent: false, reason: "SMTP or store email not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: storeEmail,
    subject: `🛒 Neue Bestellung #${order.orderNumber} — ${money(order.total)} bar`,
    html,
  });
  return { sent: true };
}

/** Email sent to the customer when their order status changes. */
export async function sendStatusUpdateEmail(order: OrderWithItems) {
  if (!order.customerEmail) return { sent: false, reason: "Contact details removed" };
  const transport = getTransport();
  const statusText: Record<string, string> = {
    PACKED: "Ihre Bestellung wurde gepackt",
    OUT_FOR_DELIVERY: "Ihre Bestellung ist unterwegs",
    DELIVERED: order.fulfillment === "PICKUP" ? "Ihre Bestellung wurde abgeholt" : "Ihre Bestellung wurde zugestellt",
    CANCELLED: "Ihre Bestellung wurde storniert",
  };
  if (order.status === "PACKED" && order.fulfillment === "PICKUP") statusText.PACKED = "Ihre Bestellung ist abholbereit";
  const label = statusText[order.status];
  if (!label) return { sent: false, reason: "No email for this status" };

  const html = baseWrapper(
    label,
    order.status === "CANCELLED"
      ? `<p>Bestellung <b>#${escapeHtml(order.orderNumber)}</b> wurde storniert${
          order.cancelReason ? ` (${escapeHtml(order.cancelReason)})` : ""
        }. Es fällt keine Zahlung an.</p><p>Fragen? Rufen Sie uns an: ${STORE.phoneDisplay}</p>`
      : `<p>Bestellung <b>#${escapeHtml(order.orderNumber)}</b> — Gesamt ${money(order.total)} (bar bei ${
          order.fulfillment === "PICKUP" ? "Abholung" : "Lieferung"
        }).</p>${
          order.status === "PACKED" && order.fulfillment === "PICKUP"
            ? `<p>Abholung: ${STORE.street}, ${STORE.postalCode} ${STORE.city} · Mo–Sa 07:00–20:00 Uhr</p>`
            : ""
        }`
  );

  if (!transport) {
    console.warn("[mailer] SMTP not configured — skipping status email for order", order.orderNumber);
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: order.customerEmail,
    subject: `Bestellung #${order.orderNumber}: ${label}`,
    html,
  });
  return { sent: true };
}

/** Email sent to the store owner when a product size drops to/below the low-stock threshold. */
export async function sendLowStockAlert(items: { productName: string; sizeLabel: string; stock: number }[]) {
  const transport = getTransport();
  const storeEmail = process.env.STORE_NOTIFICATION_EMAIL;
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin/products`;

  if (items.length === 0) return { sent: false, reason: "Nothing to report" };

  const html = baseWrapper(
    "Niedriger Lagerbestand",
    `
    <p>Die folgenden Artikel gehen zur Neige:</p>
    <ul style="font-size:14px">
      ${items.map((i) => `<li><b>${escapeHtml(i.productName)}</b> (${escapeHtml(i.sizeLabel)}) — noch ${i.stock}</li>`).join("")}
    </ul>
    <p><a href="${adminUrl}" style="display:inline-block;margin-top:12px;background:#a12e3d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Produkte verwalten</a></p>
    `
  );

  if (!transport || !storeEmail) {
    console.warn("[mailer] SMTP or STORE_NOTIFICATION_EMAIL not configured — skipping low-stock email");
    return { sent: false, reason: "SMTP or store email not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: storeEmail,
    subject: `⚠️ Niedriger Bestand: ${items.map((i) => i.productName).join(", ")}`,
    html,
  });
  return { sent: true };
}

/** Email sent on registration (and on resend) with the one-time code to verify the account's email. */
export async function sendVerificationEmail(email: string, name: string, code: string) {
  const transport = getTransport();
  const html = baseWrapper(
    "Bestätigen Sie Ihre E-Mail-Adresse",
    `
    <p>Hallo ${escapeHtml(name)}, verwenden Sie diesen Code, um Ihre E-Mail-Adresse zu bestätigen:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;margin:20px 0;color:#a12e3d">${escapeHtml(code)}</p>
    <p style="font-size:12px;color:#8a918c">Dieser Code läuft in 15 Minuten ab. Sie müssen Ihre E-Mail bestätigen, bevor Sie eine Bestellung aufgeben können.</p>
    <p style="font-size:12px;color:#8a918c">Falls Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.</p>
    `
  );

  if (!transport) {
    console.warn("[mailer] SMTP not configured — skipping verification email");
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Ihr Bestätigungscode: ${code}`,
    html,
  });
  return { sent: true };
}

/** Email with a one-time link to choose a new password. */
export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string) {
  const transport = getTransport();
  const html = baseWrapper(
    "Passwort zurücksetzen",
    `
    <p>Hallo ${escapeHtml(name)}, Sie haben angefordert, Ihr Passwort zurückzusetzen.</p>
    <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;margin:12px 0;background:#a12e3d;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Neues Passwort festlegen</a></p>
    <p style="font-size:12px;color:#8a918c">Der Link ist 60 Minuten gültig und kann nur einmal verwendet werden.</p>
    <p style="font-size:12px;color:#8a918c">Falls Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren — Ihr Passwort bleibt unverändert.</p>
    `
  );

  if (!transport) {
    console.warn("[mailer] SMTP not configured — skipping password reset email");
    if (process.env.NODE_ENV !== "production") console.log(`[dev] password reset link for ${email}: ${resetUrl}`);
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Passwort zurücksetzen — Al-Madina Markt",
    html,
  });
  return { sent: true };
}

/**
 * Sent when someone registers with an email that already has an account. The
 * register endpoint answers identically either way (so it can't be used to
 * find out who is a customer); this email is how the real owner learns of it.
 */
export async function sendAccountExistsEmail(email: string, name: string, loginUrl: string, resetUrl: string) {
  const transport = getTransport();
  const html = baseWrapper(
    "Sie haben bereits ein Konto",
    `
    <p>Hallo ${escapeHtml(name)}, gerade wurde versucht, mit dieser E-Mail-Adresse ein neues Konto zu erstellen. Sie haben bereits eines.</p>
    <p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;margin:12px 0;background:#a12e3d;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Jetzt anmelden</a></p>
    <p>Passwort vergessen? <a href="${escapeHtml(resetUrl)}">Hier zurücksetzen</a>.</p>
    <p style="font-size:12px;color:#8a918c">Falls Sie das nicht waren, können Sie diese E-Mail ignorieren — an Ihrem Konto wurde nichts geändert.</p>
    `
  );

  if (!transport) {
    console.warn("[mailer] SMTP not configured — skipping account-exists email");
    return { sent: false, reason: "SMTP not configured" };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Sie haben bereits ein Konto — Al-Madina Markt",
    html,
  });
  return { sent: true };
}
