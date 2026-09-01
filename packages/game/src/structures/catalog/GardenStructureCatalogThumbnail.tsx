import type { ComponentPropsWithoutRef } from 'react';
import type { GardenStructureCatalogEntry } from './gardenStructureKitV1Catalog';

export type GardenStructureCatalogThumbnailProps = Omit<
    ComponentPropsWithoutRef<'img'>,
    'alt' | 'height' | 'src' | 'width'
> &
    Readonly<{
        alt?: string;
        entry: GardenStructureCatalogEntry;
    }>;

/** Static catalogue media; picker cards never allocate their own WebGL canvas. */
export function GardenStructureCatalogThumbnail({
    alt,
    decoding = 'async',
    draggable = false,
    entry,
    loading = 'lazy',
    ...props
}: GardenStructureCatalogThumbnailProps) {
    return (
        // The versioned WebP is already generated at its exact picker size;
        // keeping this package primitive framework-neutral avoids per-card loaders.
        // biome-ignore lint/performance/noImgElement: generated intrinsic-size game catalogue asset
        <img
            {...props}
            alt={alt ?? entry.label}
            data-garden-structure-catalog-id={entry.id}
            data-garden-structure-catalog-kind={entry.kind}
            decoding={decoding}
            draggable={draggable}
            height={entry.image.height}
            loading={loading}
            src={entry.image.src}
            width={entry.image.width}
        />
    );
}
