import { debugGardenStructureKitMetadata } from './debugStructureKit';
import type {
    GardenStructureBatchDescription,
    GardenStructureSemanticPlan,
} from './structurePlanTypes';

export function isGardenStructureVerticalSliceBatchVisible(
    batch: GardenStructureBatchDescription,
) {
    if (batch.geometryKind !== 'edge-segment') {
        return true;
    }

    return (
        debugGardenStructureKitMetadata.edgeParts[batch.geometryId]?.passage !==
        'open-portal'
    );
}

export function getGardenStructureVerticalSliceBatches({
    plan,
    roofCutaway,
}: {
    plan: GardenStructureSemanticPlan;
    roofCutaway: boolean;
}) {
    if (
        plan.kitKey !== debugGardenStructureKitMetadata.kitKey ||
        plan.kitVersion !== debugGardenStructureKitMetadata.kitVersion
    ) {
        throw new Error(
            'The fixture renderer only supports its matching immutable debug kit.',
        );
    }

    return [
        ...plan.batches.opaque,
        ...plan.batches.transparent,
        ...(roofCutaway ? [] : plan.batches.roof),
        ...plan.batches.props,
    ].filter(isGardenStructureVerticalSliceBatchVisible);
}
