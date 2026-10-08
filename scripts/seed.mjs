// Loads a small demo catalog into an EMPTY database (fresh setup / staging).
// Does nothing if any product already exists, so it can never touch a live
// catalog. Usage: npm run db:seed   (after npm run db:migrate)
import { readFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

const CATALOG = [
  { category: "Obst & Gemüse", name: "Tomaten", tags: ["Frisch"], unit: "pro kg", img: "photo-1592924357228-91a4daadcfea", sizes: [["1 kg", 2.49, 60]] },
  { category: "Bäckerei", name: "Fladenbrot", tags: ["Frisch", "Vegan"], img: "photo-1593504049359-74330189a345", sizes: [["1 Stück", 1.29, 80], ["3 Stück", 3.49, 40]] },
  { category: "Vorratskammer", name: "Tahini", tags: ["Vegan"], img: "photo-1511690078903-71dc5a49f5e3", sizes: [["300 g", 4.49, 30]] },
  { category: "Gewürze", name: "Za'atar", tags: ["Vegan"], img: "photo-1596040033229-a9821ebd058d", sizes: [["150 g", 3.99, 25]] },
  { category: "Fleisch & Geflügel", name: "Rindersteak", tags: ["Halal"], unit: "pro kg", img: "photo-1603048297172-c92544798d5a", sizes: [["1 kg", 24.9, 10]], old: 27.9 },
  { category: "Fleisch & Geflügel", name: "Hähnchenbrust", tags: ["Halal"], unit: "pro kg", img: "photo-1604503468506-a8da13d82791", sizes: [["500 g", 5.49, 20], ["1 kg", 9.99, 15]] },
];

const slug = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const prisma = new PrismaClient();
try {
  const existing = await prisma.$queryRawUnsafe(`select count(*)::int as n from products`);
  if (existing[0].n > 0) {
    console.log(`catalog already has ${existing[0].n} products — seed skipped`);
  } else {
    let sort = 0;
    for (const item of CATALOG) {
      const catSlug = slug(item.category);
      const cat = await prisma.$queryRawUnsafe(
        `insert into categories (name, slug, sort_order) values ($1, $2, $3)
         on conflict (slug) do update set name = excluded.name returning id`,
        item.category, catSlug, sort++
      );
      const product = await prisma.$queryRawUnsafe(
        `insert into products (category_id, name, slug, image_url, unit_note, tags)
         values ($1::uuid, $2, $3, $4, $5, $6::text[]) returning id`,
        cat[0].id, item.name, slug(item.name), IMG(item.img), item.unit ?? null, item.tags
      );
      for (const [i, [label, price, stock]] of item.sizes.entries()) {
        await prisma.$executeRawUnsafe(
          `insert into product_variants (product_id, sku, size_label, price, compare_at_price, stock_quantity, sort_order)
           values ($1::uuid, $2, $3, $4, $5, $6, $7)`,
          product[0].id, `${slug(item.name).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
          label, price, i === 0 && item.old ? item.old : null, stock, i
        );
      }
    }
    console.log(`seeded ${CATALOG.length} demo products`);
  }
} catch (err) {
  console.error("seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
