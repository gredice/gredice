import { isGardenStructureKitV1DefinitionCompatible } from './gardenStructureKitV1Compatibility';
import { getGardenStructurePlanBaselineVisiblePropInstanceIds } from './gardenStructureSceneVisibility';
import type {
    GardenStructureBatchDescription,
    GardenStructureSemanticPlan,
} from './structurePlanTypes';

export function getGardenStructureVerticalSliceVisibleInstanceIndices({
    baselineVisiblePropInstanceIds,
    batch,
    renderProps,
}: Readonly<{
    baselineVisiblePropInstanceIds: ReadonlySet<string>;
    batch: GardenStructureBatchDescription;
    renderProps: boolean;
}>) {
    return batch.instanceIds.flatMap((instanceId, index) =>
        batch.category !== 'props' ||
        renderProps ||
        baselineVisiblePropInstanceIds.has(instanceId)
            ? [index]
            : [],
    );
}

export function getGardenStructureVerticalSliceBatches({
    baselineVisiblePropInstanceIds,
    plan,
    renderProps,
    roofCutaway,
}: {
    baselineVisiblePropInstanceIds?: ReadonlySet<string>;
    plan: GardenStructureSemanticPlan;
    renderProps: boolean;
    roofCutaway: boolean;
}) {
    if (!isGardenStructureKitV1DefinitionCompatible(plan)) {
        throw new Error(
            'The fixture renderer only supports its matching immutable debug kit.',
        );
    }
    const baselinePropIds =
        baselineVisiblePropInstanceIds ??
        getGardenStructurePlanBaselineVisiblePropInstanceIds(plan);

    return [
        ...plan.batches.opaque,
        ...plan.batches.transparent,
        ...(roofCutaway ? [] : plan.batches.roof),
        ...plan.batches.props.filter(
            (batch) =>
                renderProps ||
                batch.instanceIds.some((instanceId) =>
                    baselinePropIds.has(instanceId),
                ),
        ),
    ];
}
