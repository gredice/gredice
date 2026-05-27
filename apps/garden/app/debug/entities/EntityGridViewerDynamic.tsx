'use client';

import { useEffect, useState } from 'react';

type EntityGridViewerComponent =
    typeof import('@gredice/game').EntityGridViewer;

export function EntityGridViewerDynamic() {
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
        <EntityGridViewer className="w-full h-full" debugHud showBackground />
    );
}
