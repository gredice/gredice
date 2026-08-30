'use client';

import { useEffect } from 'react';
import { GardenStructureCollectionRenderer } from './GardenStructureCollectionRenderer';
import type { GardenStructureSceneSnapshot } from './gardenStructureScene';

export type GardenStructureSceneLayerProps = Readonly<{
    castShadows?: boolean;
    onRendererReady?: () => void;
    renderProps?: boolean;
    snapshot: GardenStructureSceneSnapshot;
}>;

/** Renders a validated saved-scene snapshot inside the existing R3F scene. */
export function GardenStructureSceneLayer({
    castShadows = true,
    onRendererReady,
    renderProps = true,
    snapshot,
}: GardenStructureSceneLayerProps) {
    const plan = snapshot.plan;
    const renderable = Boolean(plan?.structures.length);
    useEffect(() => {
        if (renderable) {
            onRendererReady?.();
        }
    }, [onRendererReady, renderable]);

    if (!plan || plan.structures.length === 0) {
        return null;
    }

    return (
        <group
            name="GardenStructures:SavedSceneLayer"
            userData={{
                diagnosticIssueCodes:
                    snapshot.diagnostics.sampledIssueCodes.join(','),
                diagnosticStatus: snapshot.diagnostics.status,
                rejectedRecordCount: snapshot.diagnostics.rejectedRecordCount,
                structureCount: plan.structures.length,
                warningCount: snapshot.diagnostics.warningCount,
            }}
        >
            <GardenStructureCollectionRenderer
                castShadows={castShadows}
                plan={plan}
                renderProps={renderProps}
            />
        </group>
    );
}
