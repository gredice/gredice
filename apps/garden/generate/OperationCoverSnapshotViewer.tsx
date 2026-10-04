'use client';

import { type ComponentType, createElement, useEffect, useState } from 'react';
import type { OperationCoverSnapshotViewerProps } from '../../../packages/game/src/viewers/OperationCoverSnapshotViewer';

type OperationCoverSnapshotViewerComponent =
    ComponentType<OperationCoverSnapshotViewerProps>;

export function OperationCoverSnapshotViewer(
    props: OperationCoverSnapshotViewerProps,
) {
    const [Viewer, setViewer] =
        useState<OperationCoverSnapshotViewerComponent | null>(null);

    useEffect(() => {
        let mounted = true;

        import(
            '../../../packages/game/src/viewers/OperationCoverSnapshotViewer'
        )
            .then((module) => {
                if (mounted) {
                    setViewer(() => module.OperationCoverSnapshotViewer);
                }
            })
            .catch((error: unknown) => {
                console.error(
                    'Failed to load OperationCoverSnapshotViewer for snapshots',
                    error,
                );
            });

        return () => {
            mounted = false;
        };
    }, []);

    return Viewer ? createElement(Viewer, props) : null;
}
