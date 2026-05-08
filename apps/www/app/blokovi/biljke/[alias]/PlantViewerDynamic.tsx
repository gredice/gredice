'use client';

import type { PlantViewerProps } from '@gredice/game';
import dynamic from 'next/dynamic';

export const PlantViewerDynamic = dynamic(
    () => import('@gredice/game').then((mod) => mod.PlantViewer),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full rounded-lg bg-stone-200 dark:bg-slate-700">
                <span className="text-stone-900 dark:text-slate-50">
                    Učitavanje 3D prikaza...
                </span>
            </div>
        ),
    },
) as React.ComponentType<PlantViewerProps>;
