"use client";

import { thumbUrl } from "@/lib/thumb";

/**
 * <img> that loads the small thumbnail variant of an uploaded image, falling
 * back to the full-size original if the thumb doesn't exist (GIFs and uploads
 * that predate thumbnail generation). Use for small renders — bubbles, grid
 * cells, avatars; lightboxes should keep the original `src`.
 */
export default function ThumbImg({
  src,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  return (
    <img
      {...rest}
      src={thumbUrl(src)}
      onError={(e) => {
        const el = e.currentTarget;
        // Only one fallback hop: thumb → original. If the original is also
        // missing, let the browser show its normal broken state.
        if (el.src.endsWith("_t.webp")) el.src = src;
      }}
    />
  );
}
