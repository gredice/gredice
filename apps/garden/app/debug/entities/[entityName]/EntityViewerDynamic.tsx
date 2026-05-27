'use client';

import { useEffect, useState } from 'react';

type EntityViewerComponent = typeof import('@gredice/game').EntityViewer;

export function EntityViewerDynamic({
    entityName,
    noControl,
    rotation,
    staticEnvironment,
    zoom,
}: {
    entityName: string;
    noControl?: boolean;
    rotation?: number;
    staticEnvironment?: boolean;
    zoom?: number;
}) {
    const [EntityViewer, setEntityViewer] =
        useState<EntityViewerComponent | null>(null);

    useEffect(() => {
        let isMounted = true;

        void import('@gredice/game').then((mod) => {
            if (isMounted) {
                setEntityViewer(() => mod.EntityViewer);
            }
        });

        return () => {
            isMounted = false;
        };
    }, []);

    if (!EntityViewer) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-neutral-700">
                Loading entity scene...
            </div>
        );
    }

    return (
        <EntityViewer
            className="h-full w-full"
            debugHud
            entityName={entityName}
            noControl={noControl}
            rotation={rotation}
            showBackground
            staticEnvironment={staticEnvironment}
            zoom={zoom}
        />
    );
}
