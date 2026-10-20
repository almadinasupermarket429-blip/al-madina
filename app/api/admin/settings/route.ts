import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isOwner } from "@/lib/auth";
import { getStoreSettings, updateStoreSettings } from "@/lib/settings";
import { logAdminAction } from "@/lib/audit";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  return NextResponse.json(await getStoreSettings());
}

// Owner only. Staff may flip the "accepting orders" switch (e.g. closing early
// on a busy day) but nothing that changes prices.
export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const patch = await req.json().catch(() => ({}));
  if (!isOwner(session)) {
    const keys = Object.keys(patch);
    if (keys.some((k) => k !== "acceptingOrders")) {
      return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
    }
  }

  const error = await updateStoreSettings(patch);
  if (error) return NextResponse.json({ error }, { status: 400 });
  await logAdminAction(session, "settings.update", "settings", null, `Einstellungen geändert: ${Object.keys(patch).join(", ")}`, { changes: patch });
  return NextResponse.json(await getStoreSettings());
}
