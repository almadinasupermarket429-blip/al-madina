// After moving the product photos to a new Cloudinary account, point the stored photo
// URLs at it. Covers products.image_url, products.gallery and categories.image_url.
//
//   node scripts/rewrite-image-urls.mjs <old-cloud-name> <new-cloud-name>           preview (changes nothing)
//   node scripts/rewrite-image-urls.mjs <old-cloud-name> <new-cloud-name> --apply   write the change
//
// Run it against the database in .env. Safe to re-run.
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const [oldCloud, newCloud, flag] = process.argv.slice(2);
if (!oldCloud || !newCloud || (flag && flag !== "--apply")) {
  console.error("Usage: node scripts/rewrite-image-urls.mjs <old-cloud-name> <new-cloud-name> [--apply]");
  process.exit(1);
}
const apply = flag === "--apply";
const from = `https://res.cloudinary.com/${oldCloud}/`;
const to = `https://res.cloudinary.com/${newCloud}/`;

const prisma = new PrismaClient();
try {
  const [counts] = await prisma.$queryRaw`
    select
      (select count(*) from products where image_url like ${from + "%"})::int as products,
      (select count(*) from products where exists (select 1 from unnest(gallery) g where g like ${from + "%"}))::int as galleries,
      (select count(*) from categories where image_url like ${from + "%"})::int as categories`;
  console.log(`Rows pointing at ${oldCloud}:`, counts);
  if (!apply) {
    console.log("Preview only. Add --apply to rewrite.");
  } else {
    await prisma.$transaction([
      prisma.$executeRaw`update products set image_url = replace(image_url, ${from}, ${to}) where image_url like ${from + "%"}`,
      prisma.$executeRaw`update products set gallery = array(select replace(g, ${from}, ${to}) from unnest(gallery) g) where exists (select 1 from unnest(gallery) g where g like ${from + "%"})`,
      prisma.$executeRaw`update categories set image_url = replace(image_url, ${from}, ${to}) where image_url like ${from + "%"}`,
    ]);
    console.log("Done.");
  }
} finally {
  await prisma.$disconnect();
}
