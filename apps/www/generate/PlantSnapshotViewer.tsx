'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ComponentType, createElement, useEffect, useState } from 'react';
import type { PlantViewerProps } from '../../../packages/game/src/viewers/PlantViewer';

type PlantViewerComponent = ComponentType<PlantViewerProps>;

export function PlantSnapshotViewer(props: PlantViewerProps) {
    const [Viewer, setViewer] = useState<PlantViewerComponent | null>(null);
    const [queryClient] = useState(() => new QueryClient());

    useEffect(() => {
        let mounted = true;

        import('../../../packages/game/src/viewers/PlantViewer')
            .then((module) => {
                if (mounted) {
                    setViewer(() => module.PlantViewer);
                }
            })
            .catch((error: unknown) => {
                console.error(
                    'Failed to load PlantViewer for snapshots',
                    error,
                );
            });

        return () => {
            mounted = false;
        };
    }, []);

    return Viewer
        ? createElement(
              QueryClientProvider,
              { client: queryClient },
              createElement(Viewer, props),
          )
        : null;
}
