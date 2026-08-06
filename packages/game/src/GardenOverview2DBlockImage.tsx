'use client';

import { BlockImage } from '@gredice/ui/BlockImage';
import type { ImageProps } from 'next/image';
import Image from 'next/image';
import { useState } from 'react';

type GardenOverview2DBlockImageProps = Omit<ImageProps, 'alt' | 'src'> & {
    alt: string;
    blockName: string;
    rotationSuffix: number;
};

export function GardenOverview2DBlockImage({
    alt,
    blockName,
    rotationSuffix,
    ...props
}: GardenOverview2DBlockImageProps) {
    const src = `/assets/blocks/top-down/${encodeURIComponent(blockName)}_${rotationSuffix}.webp`;
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    // A newly introduced block can appear in live data before its generated
    // overhead snapshot ships. Keep it visible with the established asset.
    if (failedSrc === src) {
        return (
            <BlockImage
                {...props}
                alt={alt}
                blockName={blockName}
                rotationSuffix={rotationSuffix}
            />
        );
    }

    return (
        <Image
            {...props}
            alt={alt}
            src={src}
            onError={() => setFailedSrc(src)}
        />
    );
}
