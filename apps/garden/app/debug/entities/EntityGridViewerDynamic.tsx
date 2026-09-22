'use client';

import { useEffect, useMemo, useState } from 'react';
import { restoreGameProfileDate } from '../profile/game/profileDate';

type EntityGridViewerComponent =
    typeof import('@gredice/game').EntityGridViewer;

export function EntityGridViewerDynamic({
    storageKey,
    freezeTime,
}: {
    storageKey: string;
    freezeTime?: string;
}) {
    const date = useMemo(
        () => restoreGameProfileDate(freezeTime),
        [freezeTime],
    );
    const [EntityGridViewer, setEntityGridViewer] =
        useState<EntityGridViewerComponent | null>(null);

    useEffect(() => {
        let isMounted = true;

        void import('@gredice/game').then((mod) => {
            if (isMounted) {
                setEntityGridViewer(() => mod.EntityGridViewer);
            }
        });

        return () => {
            isMounted = false;
        };
    }, []);

    if (!EntityGridViewer) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-neutral-700">
                Loading entity scene...
            </div>
        );
    }

    return (
        <EntityGridViewer
            className="h-full w-full"
            freezeTime={date}
            debugHud
            localSandboxStorageKey={storageKey}
            showBackground
        />
    );
}
