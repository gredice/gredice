'use client';

import dynamic from 'next/dynamic';

const PlantCatalogPerformanceViewer = dynamic(
    () =>
        import('@gredice/game').then(
            (module) => module.PlantCatalogPerformanceViewer,
        ),
    { ssr: false },
);

export function PlantCatalogPerformanceViewerDynamic({
    showLabels = false,
}: {
    showLabels?: boolean;
}) {
    return (
        <PlantCatalogPerformanceViewer
            className="h-full w-full"
            debugHud
            showLabels={showLabels}
        />
    );
}
