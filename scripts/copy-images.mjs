// Copies every photo referenced in the database from the old Cloudinary account into a new one,
// keeping the same folder and file names (public_id), then checks that each photo resolves at the
// URL the rewritten database will use. Safe to re-run: photos that already exist are left alone.
//
//   OLD_CLOUDINARY_CLOUD_NAME=…  NEW_CLOUDINARY_CLOUD_NAME=…
//   NEW_CLOUDINARY_API_KEY=…     NEW_CLOUDINARY_API_SECRET=…
//   node scripts/copy-images.mjs            preview: lists what would be copied
//   node scripts/copy-images.mjs --apply    copy and verify
//
// Reads the database in .env (DATABASE_URL). Afterwards run scripts/rewrite-image-urls.mjs.
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const { OLD_CLOUDINARY_CLOUD_NAME: oldCloud, NEW_CLOUDINARY_CLOUD_NAME: newCloud, NEW_CLOUDINARY_API_KEY: key, NEW_CLOUDINARY_API_SECRET: secret } = process.env;
const apply = process.argv.includes("--apply");
if (!oldCloud || !newCloud || (apply && (!key || !secret))) {
  console.error("Set OLD_CLOUDINARY_CLOUD_NAME and NEW_CLOUDINARY_CLOUD_NAME (and NEW_CLOUDINARY_API_KEY / NEW_CLOUDINARY_API_SECRET with --apply).");
  process.exit(1);
}
const prefix = `https://res.cloudinary.com/${oldCloud}/image/upload/`;

const prisma = new PrismaClient();
let urls;
try {
  const rows = await prisma.$queryRaw`
    select image_url as u from products where image_url like ${prefix + "%"}
    union select g from products, unnest(gallery) g where g like ${prefix + "%"}
    union select image_url from categories where image_url like ${prefix + "%"}`;
  urls = rows.map((r) => r.u);
} finally {
  await prisma.$disconnect();
}

// "<transformations>/v123/folder/name.webp" -> { version: "v123", publicId: "folder/name", ext: "webp" }
function parse(url) {
  const rest = url.slice(prefix.length).replace(/^(?:[a-z]+_[^/]*\/)+/, "");
  const m = rest.match(/^(v\d+)\/(.+)\.([a-z0-9]+)$/i);
  return m ? { version: m[1], publicId: m[2], ext: m[3] } : null;
}

const items = [];
const bad = [];
for (const url of new Set(urls)) {
  const p = parse(url);
  if (p) items.push({ ...p, original: `${prefix}${p.version}/${p.publicId}.${p.ext}` });
  else bad.push(url);
}
console.log(`${items.length} photos to copy from ${oldCloud} to ${newCloud}` + (bad.length ? `, ${bad.length} URLs not understood (left alone)` : ""));
bad.slice(0, 5).forEach((u) => console.log("  skipped:", u));
if (!apply) {
  console.log("Preview only. Add --apply to copy.");
  process.exit(0);
}

async function copy(item) {
  const timestamp = Math.floor(Date.now() / 1000);
  // Signed params in alphabetical order, then the secret (same scheme as app/api/admin/upload).
  const signature = createHash("sha1").update(`overwrite=false&public_id=${item.publicId}&timestamp=${timestamp}${secret}`).digest("hex");
  const form = new FormData();
  form.append("file", item.original);
  form.append("public_id", item.publicId);
  form.append("overwrite", "false");
  form.append("timestamp", String(timestamp));
  form.append("api_key", key);
  form.append("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${newCloud}/image/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`upload ${res.status} ${(await res.text()).slice(0, 120)}`);
  // The check that matters: the exact URL the database will hold after the rewrite.
  const head = await fetch(`https://res.cloudinary.com/${newCloud}/image/upload/f_auto,q_auto/${item.version}/${item.publicId}.${item.ext}`, { method: "HEAD" });
  if (!head.ok) throw new Error(`rewritten URL gives ${head.status}`);
}

let done = 0;
const failed = [];
const queue = [...items];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await copy(item);
      } catch (err) {
        failed.push(`${item.publicId}: ${err.message}`);
      }
      if (++done % 25 === 0) console.log(`${done}/${items.length}`);
    }
  })
);
console.log(`Copied and verified ${items.length - failed.length}/${items.length}.`);
failed.slice(0, 20).forEach((f) => console.log("  FAILED", f));
process.exitCode = failed.length ? 1 : 0;
