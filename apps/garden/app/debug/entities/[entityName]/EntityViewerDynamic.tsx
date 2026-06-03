'use client';

import { useEffect, useState } from 'react';

type EntitySandboxViewerComponent =
    typeof import('@gredice/game').EntitySandboxViewer;

export function EntityViewerDynamic({
    entityName,
    rotation,
    storageKey,
}: {
    entityName: string;
    rotation?: number;
    storageKey: string;
}) {
    const [EntitySandboxViewer, setEntitySandboxViewer] =
        useState<EntitySandboxViewerComponent | null>(null);

    useEffect(() => {
        let isMounted = true;

        void import('@gredice/game').then((mod) => {
            if (isMounted) {
                setEntitySandboxViewer(() => mod.EntitySandboxViewer);
            }
        });

        return () => {
            isMounted = false;
        };
    }, []);

    if (!EntitySandboxViewer) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-neutral-700">
                Loading entity scene...
            </div>
        );
    }

    return (
        <EntitySandboxViewer
            className="h-full w-full"
            debugHud
            entityName={entityName}
            localSandboxStorageKey={storageKey}
            rotation={rotation}
        />
    );
}
