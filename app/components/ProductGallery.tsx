"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { sizedImage } from "@/lib/images";

/**
 * Amazon-style product photo: hover to zoom in on desktop, tap/click to open full screen.
 * Shows thumbnails when a product has more than one photo.
 */
export function ProductGallery({ images, alt, zoomHint }: { images: string[]; alt: string; zoomHint: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const current = images[index] ?? images[0];
  if (!current) return null;

  return (
    <div className="pg">
      <button
        type="button"
        className="pg-main"
        aria-label={zoomHint}
        onClick={() => setFullscreen(true)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <img
          src={sizedImage(current, 900)}
          alt={alt}
          style={zoom ? { transform: "scale(2.2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
        <span className="pg-hint">{zoomHint}</span>
      </button>

      {images.length > 1 && (
        <div className="pg-thumbs">
          {images.map((src, i) => (
            <button key={src} type="button" className={i === index ? "active" : ""} onClick={() => setIndex(i)} aria-label={`${alt} ${i + 1}`}>
              <img src={sizedImage(src, 160)} alt="" />
            </button>
          ))}
        </div>
      )}

      {fullscreen && (
        <div className="pg-full" role="dialog" aria-modal="true" onClick={() => setFullscreen(false)}>
          <button type="button" className="pg-close" aria-label="Close" onClick={() => setFullscreen(false)}>
            <X />
          </button>
          <img src={sizedImage(current, 2000)} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
