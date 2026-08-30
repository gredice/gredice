import { Box3, type Frustum } from 'three';
import type {
    GardenStructureCollectionBatchDescription,
    GardenStructureCollectionPlan,
} from './gardenStructureCollectionPlan';
import type { GardenStructureWorldBounds } from './structurePlanTypes';

export type GardenStructureSceneSubmissionMetrics = Readonly<{
    detailSuppressedPropCount: number;
    exteriorSuppressedPropCount: number;
    frustumCulledPropCount: number;
    frustumCulledStructureCount: number;
    propCount: number;
    visiblePropCount: number;
    visibleStructureCount: number;
}>;

function setWorldBoundsBox(box: Box3, bounds: GardenStructureWorldBounds) {
    box.min.set(bounds.minX, bounds.minHeight, bounds.minY);
    box.max.set(bounds.maxX, bounds.maxHeight, bounds.maxY);
    return box;
}

/** Uses the compiler's conservative visual bounds in Three.js x/y/z space. */
export function doesGardenStructureIntersectFrustum(
    bounds: GardenStructureWorldBounds,
    frustum: Frustum,
    scratchBox = new Box3(),
) {
    return frustum.intersectsBox(setWorldBoundsBox(scratchBox, bounds));
}

export function getGardenStructureFrustumVisibleIds(
    plan: GardenStructureCollectionPlan,
    frustum: Frustum,
    scratchBox = new Box3(),
) {
    return new Set(
        plan.structures
            .filter((structure) =>
                doesGardenStructureIntersectFrustum(
                    structure.worldBounds,
                    frustum,
                    scratchBox,
                ),
            )
            .map((structure) => structure.structureId),
    );
}

export function intersectGardenStructureIds(
    first: ReadonlySet<string> | undefined,
    second: ReadonlySet<string> | undefined,
) {
    if (!first) {
        return second;
    }
    if (!second) {
        return first;
    }
    return new Set([...first].filter((structureId) => second.has(structureId)));
}

export function areGardenStructureIdSetsEqual(
    first: ReadonlySet<string>,
    second: ReadonlySet<string>,
) {
    return (
        first.size === second.size &&
        [...first].every((structureId) => second.has(structureId))
    );
}

export function getGardenStructureCollectionVisibleInstanceIndices(
    batch: GardenStructureCollectionBatchDescription,
    visibleStructureIds: ReadonlySet<string> | undefined,
    visiblePropStructureIds: ReadonlySet<string> | undefined,
) {
    const effectiveVisibleIds =
        batch.category === 'props'
            ? intersectGardenStructureIds(
                  visibleStructureIds,
                  visiblePropStructureIds,
              )
            : visibleStructureIds;
    if (!effectiveVisibleIds) {
        return batch.instanceIds.map((_, index) => index);
    }
    return batch.structureIds.flatMap((structureId, index) =>
        effectiveVisibleIds.has(structureId) ? [index] : [],
    );
}

export function getGardenStructureCollectionVisibleBatches(
    batches: readonly GardenStructureCollectionBatchDescription[],
    visibleStructureIds: ReadonlySet<string> | undefined,
    visiblePropStructureIds: ReadonlySet<string> | undefined,
) {
    return batches.filter(
        (batch) =>
            getGardenStructureCollectionVisibleInstanceIndices(
                batch,
                visibleStructureIds,
                visiblePropStructureIds,
            ).length > 0,
    );
}

function countVisibleProps(
    plan: GardenStructureCollectionPlan,
    visibleStructureIds: ReadonlySet<string>,
    visiblePropStructureIds?: ReadonlySet<string>,
) {
    return plan.batches.props.reduce(
        (total, batch) =>
            total +
            getGardenStructureCollectionVisibleInstanceIndices(
                batch,
                visibleStructureIds,
                visiblePropStructureIds,
            ).length,
        0,
    );
}

export function getGardenStructureSceneSubmissionMetrics({
    plan,
    renderProps,
    visibleInteriorStructureIds,
    visibleStructureIds,
}: Readonly<{
    plan: GardenStructureCollectionPlan;
    renderProps: boolean;
    visibleInteriorStructureIds: ReadonlySet<string>;
    visibleStructureIds: ReadonlySet<string>;
}>): GardenStructureSceneSubmissionMetrics {
    const allStructureIds = new Set(
        plan.structures.map((structure) => structure.structureId),
    );
    const propCount = countVisibleProps(plan, allStructureIds);
    const frustumVisiblePropCount = countVisibleProps(
        plan,
        visibleStructureIds,
    );
    const visiblePropCount = renderProps
        ? countVisibleProps(
              plan,
              visibleStructureIds,
              visibleInteriorStructureIds,
          )
        : 0;
    return Object.freeze({
        detailSuppressedPropCount: renderProps ? 0 : frustumVisiblePropCount,
        exteriorSuppressedPropCount: renderProps
            ? frustumVisiblePropCount - visiblePropCount
            : 0,
        frustumCulledPropCount: propCount - frustumVisiblePropCount,
        frustumCulledStructureCount:
            plan.structures.length - visibleStructureIds.size,
        propCount,
        visiblePropCount,
        visibleStructureCount: visibleStructureIds.size,
    });
}
