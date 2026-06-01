'use client';

import { type ComponentType, createElement, useEffect, useState } from 'react';
import type { EntityViewerProps } from '../../../packages/game/src/viewers/EntityViewer';

type EntityViewerComponent = ComponentType<EntityViewerProps>;

// Load EntityViewer lazily (mirroring PlantSnapshotViewer) so the component-test
// bundle resolves its three.js dependencies through a dynamic chunk instead of
// the static entry graph, which Rollup cannot resolve in this build.
export function EntitySnapshotViewer(props: EntityViewerProps) {
    const [Viewer, setViewer] = useState<EntityViewerComponent | null>(null);

    useEffect(() => {
        let mounted = true;

        import('../../../packages/game/src/viewers/EntityViewer')
            .then((module) => {
                if (mounted) {
                    setViewer(() => module.EntityViewer);
                }
            })
            .catch((error: unknown) => {
                console.error(
                    'Failed to load EntityViewer for snapshots',
                    error,
                );
            });

        return () => {
            mounted = false;
        };
    }, []);

    return Viewer ? createElement(Viewer, props) : null;
}
