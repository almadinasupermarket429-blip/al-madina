import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAdminSession, isOwner } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Owner only: uploads a product photo to Cloudinary (signed upload, the secret never
// leaves the server) and returns its URL for the product form.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) {
    return NextResponse.json({ error: "Bild-Upload ist nicht eingerichtet (Cloudinary-Zugangsdaten fehlen)." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Bitte ein Bild auswählen." }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Nur JPG, PNG, WebP oder HEIC." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Das Bild ist größer als 10 MB." }, { status: 400 });

  const folder = "almadina/products";
  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signature: sha1 of the signed params in alphabetical order, followed by the API secret.
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");

  const upload = new FormData();
  upload.append("file", file);
  upload.append("folder", folder);
  upload.append("timestamp", String(timestamp));
  upload.append("api_key", key);
  upload.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: upload });
  const data = (await res.json().catch(() => ({}))) as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!res.ok || !data.secure_url) {
    console.error("[upload] cloudinary rejected the upload", data.error?.message);
    return NextResponse.json({ error: "Upload fehlgeschlagen. Bitte erneut versuchen." }, { status: 502 });
  }

  // Store the URL with automatic format/quality, like every other product photo.
  const url = data.secure_url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
  await logAdminAction(session, "image.upload", "image", data.public_id ?? null, `Bild hochgeladen: ${file.name}`);
  return NextResponse.json({ url });
}
