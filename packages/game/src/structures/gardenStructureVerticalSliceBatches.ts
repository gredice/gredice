import { debugGardenStructureKitMetadata } from './debugStructureKit';
import { validateGardenStructureKitMetadata } from './gardenStructureKitMetadataValidation';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';

const debugGardenStructureKitDefinitionFingerprint =
    validateGardenStructureKitMetadata(
        debugGardenStructureKitMetadata,
    ).kitDefinitionFingerprint;

export function getGardenStructureVerticalSliceBatches({
    plan,
    roofCutaway,
}: {
    plan: GardenStructureSemanticPlan;
    roofCutaway: boolean;
}) {
    if (
        plan.kitKey !== debugGardenStructureKitMetadata.kitKey ||
        plan.kitVersion !== debugGardenStructureKitMetadata.kitVersion ||
        !debugGardenStructureKitDefinitionFingerprint ||
        plan.kitDefinitionFingerprint !==
            debugGardenStructureKitDefinitionFingerprint
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
    ];
}
