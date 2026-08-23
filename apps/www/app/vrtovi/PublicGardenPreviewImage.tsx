'use client';

import { Sprout } from '@gredice/ui/icons';
import Image from 'next/image';
import { useState } from 'react';

export function PublicGardenPreviewImage({
    gardenName,
    previewImageUrl,
    priority = false,
}: {
    gardenName: string;
    previewImageUrl?: string | null;
    priority?: boolean;
}) {
    const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
    const visibleImageUrl =
        previewImageUrl && previewImageUrl !== failedImageUrl
            ? previewImageUrl
            : null;

    return (
        <div className="relative aspect-[1200/630] w-full overflow-hidden bg-muted">
            <div
                aria-hidden={Boolean(visibleImageUrl)}
                aria-label={`Pregled vrta ${gardenName} još nije dostupan`}
                className="absolute inset-0 grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--color-border)_55%,transparent)_1px,transparent_0)] bg-[size:18px_18px]"
                role="img"
            >
                <div className="flex max-w-[80%] items-center gap-2 rounded-full border bg-background/85 px-4 py-2 text-muted-foreground shadow-sm backdrop-blur-sm">
                    <Sprout aria-hidden className="size-4 shrink-0" />
                    <span className="truncate text-sm font-medium">
                        Pregled se priprema
                    </span>
                </div>
            </div>
            {visibleImageUrl ? (
                <Image
                    src={visibleImageUrl}
                    alt={`Prikaz vrta ${gardenName}`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    priority={priority}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    onError={() => setFailedImageUrl(visibleImageUrl)}
                />
            ) : null}
        </div>
    );
}
