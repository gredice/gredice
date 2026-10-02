import type { ImageLoaderProps } from 'next/image';

// The checked-in block snapshot generator and all block WebPs use 640px sources.
// Larger optimizer widths cannot add detail and only create additional cache keys.
// Match WWW's sole allowed optimizer quality; custom loaders bypass Next's coercion.
export function generatedBlockImageLoader({ src, width }: ImageLoaderProps) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${Math.min(width, 640)}&q=75`;
}
