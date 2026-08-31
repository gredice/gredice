import { isGardenStructureKitV1DefinitionCompatible } from './gardenStructureKitV1Compatibility';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';

export function getGardenStructureVerticalSliceBatches({
    plan,
    roofCutaway,
}: {
    plan: GardenStructureSemanticPlan;
    roofCutaway: boolean;
}) {
    if (!isGardenStructureKitV1DefinitionCompatible(plan)) {
        throw new Error(
            'The fixture renderer only supports its matching immutable debug kit.',
        );
    }

    return [
        ...plan.batches.opaque,
        ...plan.batches.transparent,
        ...(roofCutaway ? [] : plan.batches.roof),
        ...plan.batches.props,
    ];
}
