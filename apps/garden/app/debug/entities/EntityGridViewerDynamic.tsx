'use client';

import dynamic from 'next/dynamic';

const EntityGridViewer = dynamic(
    () => import('@gredice/game').then((mod) => mod.EntityGridViewer),
    { ssr: false },
);

export function EntityGridViewerDynamic() {
    return <EntityGridViewer className="w-full h-full" />;
}
