import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isOwner } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { anonymizeAccount, deletionBlocker, exportAccountData } from "@/lib/account-data";

// Owner only: GDPR requests handled by the shop (e.g. a customer asks by phone or email).
//   GET    → download everything stored about the customer (Art. 15 / 20)
//   DELETE → erase the customer's personal data, keeping orders for the legal retention period (Art. 17)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;
  const data = await exportAccountData(id).catch(() => null);
  if (!data) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  await logAdminAction(session, "customer.export", "customer", id, `Datenauskunft erstellt, Konto ${id.slice(0, 8)}`);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kundendaten-${id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;
  const data = await exportAccountData(id).catch(() => null);
  if (!data) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });

  const blocker = await deletionBlocker(id);
  if (blocker === "ADMIN") return NextResponse.json({ error: "Dieses Konto gehört zum Team. Bitte zuerst im Team-Bereich entfernen." }, { status: 409 });
  if (blocker === "OPEN_ORDERS") return NextResponse.json({ error: "Der Kunde hat noch offene Bestellungen." }, { status: 409 });

  await anonymizeAccount(id);
  await logAdminAction(session, "customer.delete", "customer", id, `Kundendaten gelöscht (DSGVO Art. 17), Konto ${id.slice(0, 8)}`);
  return NextResponse.json({ ok: true });
}
