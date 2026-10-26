// Imports a product catalog JSON (built from the shop's own product photos) into the database.
// Usage: node scripts/import-products.mjs <products.json> <uploaded.json>
//
// - Categories are matched by slug and created if missing (German name + English name).
// - Products are matched by legacy_id "photo:<key>", so re-running updates text and images
//   but never touches prices or stock the owner has already changed.
// - Products without an uploaded image are skipped and listed at the end.
import { readFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const [catalogPath, uploadedPath] = process.argv.slice(2);
if (!catalogPath || !uploadedPath) {
  console.error("usage: node scripts/import-products.mjs <products.json> <uploaded.json>");
  process.exit(1);
}
const { categories, products } = JSON.parse(readFileSync(catalogPath, "utf8"));
const uploaded = JSON.parse(readFileSync(uploadedPath, "utf8"));

const slugify = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Serve Cloudinary images in the best format/quality for each browser.
const deliveryUrl = (url) => url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");

const prisma = new PrismaClient();
try {
  // 1. Categories (several internal keys can share one category name).
  const categoryIds = {};
  for (const [key, [nameDe, nameEn, sort]] of Object.entries(categories)) {
    const slug = slugify(nameDe);
    if (!categoryIds[slug]) {
      const rows = await prisma.$queryRawUnsafe(
        `insert into categories (name, name_en, slug, sort_order, is_active) values ($1, $2, $3, $4, true)
         on conflict (slug) do update set name = excluded.name, name_en = excluded.name_en, sort_order = excluded.sort_order, is_active = true
         returning id`,
        nameDe, nameEn, slug, sort
      );
      categoryIds[slug] = rows[0].id;
    }
    categoryIds[key] = categoryIds[slug];
  }

  // 2. Products + one size each.
  const skipped = [];
  let created = 0, updated = 0;
  const sortInCategory = {};
  for (const p of products) {
    const image = uploaded[p.key];
    if (!image) { skipped.push(p.key); continue; }
    const sort = (sortInCategory[p.cat] = (sortInCategory[p.cat] ?? -1) + 1);
    const legacyId = `photo:${p.key}`;
    const rows = await prisma.$queryRawUnsafe(
      `insert into products (category_id, name, name_en, slug, description, description_en, brand, highlights, highlights_en,
                             specs, image_url, is_active, sort_order, legacy_id)
       values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::text[], $9::text[], $10::jsonb, $11, true, $12, $13)
       on conflict (legacy_id) do update set
         category_id = excluded.category_id, name = excluded.name, name_en = excluded.name_en,
         description = excluded.description, description_en = excluded.description_en, brand = excluded.brand,
         highlights = excluded.highlights, highlights_en = excluded.highlights_en, specs = excluded.specs,
         image_url = excluded.image_url, sort_order = excluded.sort_order, updated_at = now()
       returning id, (xmax = 0) as inserted`,
      categoryIds[p.cat], p.name, p.nameEn, p.key, p.description, p.descriptionEn, p.brand,
      p.highlights, p.highlightsEn, JSON.stringify(p.specs), deliveryUrl(image), sort, legacyId
    );
    const { id, inserted } = rows[0];
    if (inserted) created++; else updated++;
    await prisma.$executeRawUnsafe(
      `insert into product_variants (product_id, sku, size_label, price, stock_quantity, sort_order, legacy_id)
       values ($1::uuid, $2, $3, $4, 50, 0, $5)
       on conflict (legacy_id) do nothing`,
      id, `${p.key.toUpperCase().slice(0, 24)}-${randomBytes(3).toString("hex").toUpperCase()}`, p.size, p.price, `${legacyId}:1`
    );
  }

  // 3. Hide the old demo catalog (kept, not deleted, because past orders point at it).
  const hidden = await prisma.$executeRawUnsafe(`update products set is_active = false where (legacy_id is null or legacy_id not like 'photo:%') and is_active`);
  await prisma.$executeRawUnsafe(
    `update categories c set is_active = false
     where c.is_active and not exists (select 1 from products p where p.category_id = c.id and p.is_active)`
  );

  console.log(`created ${created}, updated ${updated}, hid ${hidden} demo products`);
  if (skipped.length) console.log(`skipped (no image yet): ${skipped.join(", ")}`);
} finally {
  await prisma.$disconnect();
}
