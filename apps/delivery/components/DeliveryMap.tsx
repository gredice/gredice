'use client';

import Image from 'next/image';

export function DeliveryMap({
    mapUrl,
    version,
    title,
}: {
    mapUrl: string;
    version: string | null;
    title: string;
}) {
    const separator = mapUrl.includes('?') ? '&' : '?';
    const src = `${mapUrl}${separator}v=${encodeURIComponent(version ?? 'initial')}`;
    return (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border bg-muted">
            <Image
                src={src}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, 720px"
                className="object-cover"
                unoptimized
                priority
            />
        </div>
    );
}
