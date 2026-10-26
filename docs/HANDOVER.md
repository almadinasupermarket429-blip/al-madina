# Handover: moving the shop to the owner's own accounts

Everything the shop depends on is configured through environment variables, so moving it is a matter of creating
new accounts and changing values. Nothing account-specific is hardcoded in the code any more.

## Checklist

1. **GitHub**: transfer the repository to the owner's account (Settings → Transfer), or push it to a new repo there.
2. **Neon**: owner creates a project (region Frankfurt). Copy both the *pooled* (`DATABASE_URL`) and *direct* (`DIRECT_URL`) strings.
3. **Cloudinary**: owner creates an account. Note its cloud name, API key and API secret.
4. **Email**: owner creates an SMTP sender (see SETUP.md section 4) → `SMTP_*`, `STORE_NOTIFICATION_EMAIL`.
5. **Google sign-in** (optional): owner creates an OAuth client in Google Cloud Console; redirect URI is
   `<site url>/api/account/google/callback` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
6. **Vercel**: owner imports the GitHub repo, sets every variable from `.env.example`, region is already fixed in `vercel.json`.
7. **Domain**: point it at Vercel, set `NEXT_PUBLIC_SITE_URL` to it.
8. **New secrets**: generate a new `JWT_SECRET` (`openssl rand -base64 48`) and a new `ADMIN_PASSWORD`. Changing
   `JWT_SECRET` signs everyone out once, which is fine.
9. **Legal pages**: fill in the `[PLATZHALTER]` fields in `app/impressum`, `app/datenschutz` and `app/widerruf`
   with the owner's legal details, and have them reviewed.
10. Remove the old accounts' access (developer's Neon, Cloudinary, Vercel, SMTP, Google client) once the new site is verified.

## Moving the database

Needs the PostgreSQL client tools (`pg_dump`, `pg_restore`). Use **direct** (non-pooled) connection strings.

```bash
# 1. Dump the current database (reads DIRECT_URL from .env, or set SOURCE_DATABASE_URL)
npm run db:transfer -- dump al-madina.dump

# 2. Restore into the owner's new, empty Neon database
TARGET_DATABASE_URL="postgresql://…new direct string…" npm run db:transfer -- restore al-madina.dump

# 3. Point .env (or Vercel) at the new database, then make sure the schema is current
npm run db:migrate
```

The dump holds customer data (names, addresses, orders): transfer it privately and delete it afterwards.
If you would rather start empty, skip steps 1–2: `npm run db:migrate` builds the schema and the owner adds
products in the admin.

Neon projects can also be transferred between accounts from the Neon console, which avoids the dump entirely.

## Moving the product photos

The database stores full Cloudinary URLs, so the photos and the stored URLs must move together.

1. Copy the photos with the script (same folder and file names; Cloudinary fetches each one from the old account's public URL,
   then the script checks that the URL the database will hold after the rewrite resolves on the new account):
   ```powershell
   $env:OLD_CLOUDINARY_CLOUD_NAME = "<old cloud name>"; $env:NEW_CLOUDINARY_CLOUD_NAME = "<new cloud name>"
   $env:NEW_CLOUDINARY_API_KEY = "…"; $env:NEW_CLOUDINARY_API_SECRET = "…"
   npm run images:copy                  # preview
   npm run images:copy -- --apply       # copy and verify
   ```
   It reads the database from `DATABASE_URL` (in `.env` or the environment). Cloudinary serves any version number of an
   existing file, so the stored `v…` part does not need to match.
2. Set `CLOUDINARY_CLOUD_NAME` (and key/secret) to the new account and redeploy (it is read at build time).
3. Rewrite the stored URLs:
   ```bash
   npm run db:rewrite-images -- <old-cloud-name> <new-cloud-name>           # preview
   npm run db:rewrite-images -- <old-cloud-name> <new-cloud-name> --apply   # write
   ```
4. Open the shop and a few product pages and check that the photos load.

Until `CLOUDINARY_CLOUD_NAME` is set, photo URLs are used as stored (served straight from Cloudinary), so nothing breaks
while you move things over.
