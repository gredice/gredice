'use client';

import type { PlantViewerProps } from '@gredice/game';
import dynamic from 'next/dynamic';

export const PlantViewerDynamic = dynamic(
    () => import('@gredice/game').then((mod) => mod.PlantViewer),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg">
                <span className="text-muted-foreground">
                    Učitavanje 3D prikaza...
                </span>
            </div>
        ),
    },
) as React.ComponentType<PlantViewerProps>;
