import type { PublicGardenViewerProps } from '@gredice/game';
import dynamic from 'next/dynamic';

export const PublicGardenViewerDynamic = dynamic<PublicGardenViewerProps>(
    () => import('@gredice/game').then((mod) => mod.PublicGardenViewer),
    {
        ssr: false,
        loading: () => (
            <div className="h-[520px] rounded-2xl border border-black/10 bg-background/60 animate-pulse" />
        ),
    },
);
