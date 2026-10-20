import type { NextConfig } from "next";

// Not a secret: the cloud name is part of every public image URL.
const CLOUDINARY_CLOUD = "a2x0mlwu";

// The Content-Security-Policy is set per request in middleware.ts (it needs a
// fresh script nonce each time); the static security headers live here.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Product photos are served through our own domain (/img/...) instead of straight from
  // Cloudinary, so visitors' browsers (and IP addresses) never contact Cloudinary (GDPR).
  // Limited to our own Cloudinary account so this can't be used as an open proxy.
  async rewrites() {
    return [{ source: "/img/:path*", destination: `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
