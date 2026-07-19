/* Derive the thumbnail URL for an uploaded image.
 *
 * The upload endpoint writes a small companion WebP next to every full image
 * ({uuid}.jpg → {uuid}_t.webp). Chat bubbles, gallery cells, and avatars render
 * tiny, so loading the 2560px original there wastes 10–20× the bandwidth.
 *
 * Only our own /uploads/ URLs are rewritten; anything else (external URLs,
 * blob: previews) passes through untouched. GIFs keep the original — a static
 * thumb would freeze the animation. Old uploads have no thumb on disk, so
 * consumers must pair this with an onError fallback to the original
 * (ThumbImg does this).
 */
const UPLOAD_IMAGE_RE = /^(\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|jpeg|png|webp)$/i;

export function thumbUrl(url: string): string {
  const m = url.match(UPLOAD_IMAGE_RE);
  return m ? `${m[1]}_t.webp` : url;
}
