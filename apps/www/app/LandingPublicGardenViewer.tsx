'use client';

import type { PublicGardenViewerProps } from '@gredice/game';
import dynamic from 'next/dynamic';

export const LandingPublicGardenViewer = dynamic<PublicGardenViewerProps>(
    () => import('@gredice/game').then((module) => module.PublicGardenViewer),
    {
        ssr: false,
        loading: () => <div className="size-full animate-pulse bg-[#d9f2dc]" />,
    },
);
