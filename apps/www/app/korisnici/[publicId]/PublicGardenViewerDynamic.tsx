import type { PublicGardenViewerProps } from '@gredice/game';
import dynamic from 'next/dynamic';

export const PublicGardenViewerDynamic = dynamic<PublicGardenViewerProps>(
    () => import('@gredice/game').then((mod) => mod.PublicGardenViewer),
    {
        ssr: false,
        loading: () => (
            <div className="h-full animate-pulse bg-background/60 motion-reduce:animate-none" />
        ),
    },
);
