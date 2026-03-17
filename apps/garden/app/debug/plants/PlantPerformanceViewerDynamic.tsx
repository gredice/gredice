'use client';

import dynamic from 'next/dynamic';

const PlantPerformanceViewer = dynamic(
    () => import('@gredice/game').then((mod) => mod.PlantPerformanceViewer),
    { ssr: false },
);

export function PlantPerformanceViewerDynamic() {
    return <PlantPerformanceViewer className="h-full w-full" />;
}
