'use client';

import dynamic from 'next/dynamic';

const PlantEditorLazy = dynamic(
    () => import('@gredice/game').then((mod) => mod.PlantEditor),
    {
        ssr: false,
    },
);

export function PlantEditorDynamic({ initialPlantType }: { initialPlantType?: string }) {
    return <PlantEditorLazy initialPlantType={initialPlantType} />;
}
