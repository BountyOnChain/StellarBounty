"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

type LightboxImage = {
  src: string;
  alt: string;
};

/**
 * A full-screen image lightbox that respects reduced-motion preferences.
 * Renders a dark overlay with the image centred.
 *
 * - Closes on Esc key or overlay click
 * - Respects `prefers-reduced-motion` (no fade-in animation when set)
 */
export function ImageLightbox({ image, onClose }: { image: LightboxImage; onClose: () => void }) {
  const reducedMotion = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger the fade-in on next frame so the CSS transition applies.
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    // Prevent background scrolling while lightbox is open.
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Image: ${image.alt}`}
      className={`lightbox-overlay cursor-pointer transition-opacity duration-300 ${
        visible && !reducedMotion ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt}
        className={reducedMotion ? "animate-none" : ""}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/**
 * A clickable image thumbnail that opens a lightbox on click.
 * Can be used as a drop-in replacement for `<img>` tags.
 */
export function LightboxImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`cursor-pointer ${className ?? ""}`}
        onClick={() => setOpen(true)}
        aria-label={`View full-size image: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="pointer-events-none" />
      </button>
      {open && <ImageLightbox image={{ src, alt }} onClose={() => setOpen(false)} />}
    </>
  );
}