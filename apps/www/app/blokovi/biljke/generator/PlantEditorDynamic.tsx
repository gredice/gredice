'use client';

import dynamic from 'next/dynamic';

export const PlantEditorDynamic = dynamic(
    () => import('@gredice/game').then((mod) => mod.PlantEditor),
    {
        ssr: false,
    },
);
