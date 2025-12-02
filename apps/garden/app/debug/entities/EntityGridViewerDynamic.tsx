'use client';

import { entityNameMap } from '@gredice/game';
import dynamic from 'next/dynamic';

const EntityGridViewer = dynamic(
    () => import('@gredice/game').then((mod) => mod.EntityGridViewer),
    { ssr: false },
);

const entityNames = Object.keys(entityNameMap);

export function EntityGridViewerDynamic() {
    return (
        <EntityGridViewer entityNames={entityNames} className="w-full h-full" />
    );
}
