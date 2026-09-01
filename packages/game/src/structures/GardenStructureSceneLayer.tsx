'use client';

import { GardenStructureCollectionRenderer } from './GardenStructureCollectionRenderer';
import type { GardenStructureSceneSnapshot } from './gardenStructureScene';

export type GardenStructureSceneLayerProps = Readonly<{
    castShadows?: boolean;
    hiddenInstanceIds?: ReadonlySet<string>;
    onRendererReady?: () => void;
    renderProps?: boolean;
    snapshot: GardenStructureSceneSnapshot;
}>;

/** Renders a validated saved-scene snapshot inside the existing R3F scene. */
export function GardenStructureSceneLayer({
    castShadows = true,
    hiddenInstanceIds,
    onRendererReady,
    renderProps = true,
    snapshot,
}: GardenStructureSceneLayerProps) {
    const plan = snapshot.plan;

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
                hiddenInstanceIds={hiddenInstanceIds}
                onRendererReady={onRendererReady}
                plan={plan}
                renderProps={renderProps}
            />
        </group>
    );
}
