import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { resolveCategoryId } from "@/lib/catalog-admin";

// Owner only: one action applied to many products at once.
//   { ids, action: "show" | "hide" | "delete" }
//   { ids, action: "category", value: "Reis" }
//   { ids, action: "price_percent", value: 10 }   (+10 % / -5 % on every size, rounded to cents)
const ACTIONS = ["show", "hide", "delete", "category", "price_percent"] as const;
type Action = (typeof ACTIONS)[number];
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && UUID.test(x)) : [];
  const action = body.action as Action;
  if (ids.length === 0 || ids.length > 1000) return NextResponse.json({ error: "Bitte Produkte auswählen." }, { status: 400 });
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });

  let summary: string;
  switch (action) {
    case "show":
    case "hide": {
      const active = action === "show";
      await prisma.$executeRaw`update products set is_active = ${active}, updated_at = now() where id = any(${ids}::uuid[])`;
      summary = `${ids.length} Produkte ${active ? "eingeblendet" : "ausgeblendet"}`;
      break;
    }
    case "delete": {
      await prisma.$executeRaw`delete from products where id = any(${ids}::uuid[])`;
      summary = `${ids.length} Produkte gelöscht`;
      break;
    }
    case "category": {
      const name = typeof body.value === "string" ? body.value.trim() : "";
      if (!name) return NextResponse.json({ error: "Bitte eine Kategorie angeben." }, { status: 400 });
      const categoryId = await resolveCategoryId(name);
      await prisma.$executeRaw`update products set category_id = ${categoryId}::uuid, updated_at = now() where id = any(${ids}::uuid[])`;
      summary = `${ids.length} Produkte nach „${name}“ verschoben`;
      break;
    }
    case "price_percent": {
      const pct = Number(body.value);
      if (!Number.isFinite(pct) || pct <= -90 || pct > 500 || pct === 0) {
        return NextResponse.json({ error: "Bitte eine Prozentzahl zwischen -90 und 500 angeben." }, { status: 400 });
      }
      await prisma.$executeRaw`
        update product_variants set price = round(price * (1 + ${pct}::numeric / 100), 2), updated_at = now()
        where product_id = any(${ids}::uuid[])
      `;
      summary = `Preise von ${ids.length} Produkten um ${pct > 0 ? "+" : ""}${pct} % geändert`;
      break;
    }
  }

  await logAdminAction(session, `product.bulk.${action}`, "product", null, summary, { ids, value: body.value ?? null });
  return NextResponse.json({ ok: true, summary });
}
