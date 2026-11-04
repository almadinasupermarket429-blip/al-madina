import type { MetadataRoute } from "next";
import { STORE } from "@/lib/store-info";

/** Lets phones add the shop to the home screen like an app (served as /manifest.webmanifest). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: STORE.name,
    short_name: "Al-Madina",
    description: STORE.tagline.de,
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#a12e3d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
