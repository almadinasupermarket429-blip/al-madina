// Moves the whole database between Postgres servers (e.g. from the developer's Neon
// project to the client's). Needs the PostgreSQL client tools (pg_dump, pg_restore) installed.
//
//   node scripts/db-transfer.mjs dump    [file]   dump the database in SOURCE_DATABASE_URL (default: DIRECT_URL / DATABASE_URL from .env)
//   node scripts/db-transfer.mjs restore [file]   restore into TARGET_DATABASE_URL (must be an empty database)
//
// Use direct (non-pooled) connection strings. The dump contains customer data: keep it
// private and delete it once the new database is verified.
import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const [command, fileArg] = process.argv.slice(2);
const file = fileArg ?? "al-madina.dump";

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) {
    console.error(`Could not run ${cmd}: ${res.error.message}. Install the PostgreSQL client tools first.`);
    process.exit(1);
  }
  if (res.status !== 0) process.exit(res.status ?? 1);
}

if (command === "dump") {
  const url = process.env.SOURCE_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set SOURCE_DATABASE_URL (or DIRECT_URL in .env).");
  run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${file}`, url]);
  console.log(`Dumped to ${file}`);
} else if (command === "restore") {
  const url = process.env.TARGET_DATABASE_URL;
  if (!url) throw new Error("Set TARGET_DATABASE_URL to the new database's direct connection string.");
  if (!existsSync(file)) throw new Error(`${file} not found.`);
  run("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", `--dbname=${url}`, file]);
  console.log(`Restored ${file}. Next: point DATABASE_URL/DIRECT_URL at the new database and run "npm run db:migrate".`);
} else {
  console.error("Usage: node scripts/db-transfer.mjs dump|restore [file]");
  process.exit(1);
}
