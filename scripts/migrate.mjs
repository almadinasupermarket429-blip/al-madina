// Applies every db/migrations/*.sql file in name order against DATABASE_URL.
// Each migration is written to be idempotent (create ... if not exists, etc.),
// so re-running this is safe. Usage: npm run db:migrate
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const dir = join(process.cwd(), "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const prisma = new PrismaClient();

// Splits on semicolons that end a line (trailing -- comments allowed), keeping $$-quoted bodies intact.
function statements(sql) {
  const out = [];
  let current = "";
  let inDollar = false;
  // Split on CRLF too: with Windows line endings "." in the comment regex below stops at the "\r",
  // a trailing "-- comment" is not removed, and two statements end up in one prepared query.
  for (const line of sql.split(/\r?\n/)) {
    if (line.trim().startsWith("--") && !inDollar) continue;
    current += line + "\n";
    if ((line.match(/\$\$/g) || []).length % 2 === 1) inDollar = !inDollar;
    // Ignore a trailing "-- comment" when looking for the terminating semicolon.
    if (!inDollar && line.replace(/--.*$/, "").trim().endsWith(";")) {
      out.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

try {
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const stmts = statements(sql);
    await prisma.$transaction(stmts.map((s) => prisma.$executeRawUnsafe(s)));
    console.log(`applied ${file} (${stmts.length} statements)`);
  }
} catch (err) {
  console.error("migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
