'use client';

import type { PublicGardenViewerProps } from '@gredice/game';
import dynamic from 'next/dynamic';

export const PublicGardenViewerDynamic = dynamic<PublicGardenViewerProps>(
    () => import('@gredice/game').then((mod) => mod.PublicGardenViewer),
    {
        ssr: false,
        loading: () => (
            <div className="h-full min-h-[520px] animate-pulse rounded-md border border-black/10 bg-background/60" />
        ),
    },
);
