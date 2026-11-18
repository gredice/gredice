'use client';

import { type ComponentType, createElement, useEffect, useState } from 'react';
import type { GameAssetSnapshotViewerProps } from '../../../packages/game/src/viewers/GameAssetSnapshotViewer';

type GameAssetSnapshotViewerComponent =
    ComponentType<GameAssetSnapshotViewerProps>;

export function GameAssetSnapshotViewer(props: GameAssetSnapshotViewerProps) {
    const [Viewer, setViewer] =
        useState<GameAssetSnapshotViewerComponent | null>(null);

    useEffect(() => {
        let mounted = true;

        import('../../../packages/game/src/viewers/GameAssetSnapshotViewer')
            .then((module) => {
                if (mounted) {
                    setViewer(() => module.GameAssetSnapshotViewer);
                }
            })
            .catch((error: unknown) => {
                console.error(
                    'Failed to load the game asset snapshot viewer',
                    error,
                );
            });

        return () => {
            mounted = false;
        };
    }, []);

    return Viewer ? createElement(Viewer, props) : null;
}
