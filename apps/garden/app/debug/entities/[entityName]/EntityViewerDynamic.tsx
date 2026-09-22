'use client';

import { useEffect, useMemo, useState } from 'react';
import { restoreGameProfileDate } from '../../profile/game/profileDate';

type EntitySandboxViewerComponent =
    typeof import('@gredice/game').EntitySandboxViewer;

export function EntityViewerDynamic({
    entityName,
    freezeTime,
    rotation,
    storageKey,
    variant,
}: {
    entityName: string;
    freezeTime?: string;
    rotation?: number;
    storageKey: string;
    variant?: number;
}) {
    const date = useMemo(
        () => restoreGameProfileDate(freezeTime),
        [freezeTime],
    );
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
            freezeTime={date}
            localSandboxStorageKey={storageKey}
            rotation={rotation}
            variant={variant}
        />
    );
}
