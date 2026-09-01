import { Box3, type Frustum } from 'three';
import type {
    GardenStructureCollectionBatchDescription,
    GardenStructureCollectionPlan,
} from './gardenStructureCollectionPlan';
import type {
    GardenStructureSemanticPlan,
    GardenStructureWorldBounds,
} from './structurePlanTypes';

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

function structureCellKey(x: number, y: number) {
    return `${x}|${y}`;
}

/**
 * Props remain visible from outside when their owning cell is explicitly
 * outdoor, has no roof, or is covered only by a transparent roof. Interior
 * props below an opaque roof are admitted separately by avatar state.
 */
export function getGardenStructurePlanBaselineVisiblePropInstanceIds(
    plan: GardenStructureSemanticPlan,
) {
    const visiblePropInstanceIds = new Set<string>();
    const opaqueRoofCellKeys = new Set<string>();
    for (const batch of plan.batches.roof) {
        if (batch.transparency !== 'opaque') {
            continue;
        }
        for (let index = 0; index < batch.instanceIds.length; index += 1) {
            const offset = index * batch.transformStride;
            const x = batch.transforms[offset];
            const y = batch.transforms[offset + 1];
            if (x !== undefined && y !== undefined) {
                opaqueRoofCellKeys.add(structureCellKey(x, y));
            }
        }
    }

    for (const batch of plan.batches.props) {
        for (const [index, instanceId] of batch.instanceIds.entries()) {
            const offset = index * batch.transformStride;
            const x = batch.transforms[offset];
            const y = batch.transforms[offset + 1];
            if (x === undefined || y === undefined) {
                continue;
            }
            const cellKey = structureCellKey(x, y);
            const footprintIndex = plan.footprint.indexByKey[cellKey];
            const coveredOutdoor =
                footprintIndex !== undefined &&
                plan.footprint.spaceKinds[footprintIndex] === 1;
            if (coveredOutdoor || !opaqueRoofCellKeys.has(cellKey)) {
                visiblePropInstanceIds.add(instanceId);
            }
        }
    }

    return visiblePropInstanceIds;
}

export function getGardenStructureBaselineVisiblePropInstanceIds(
    plan: GardenStructureCollectionPlan,
) {
    const visiblePropInstanceIds = new Set<string>();
    for (const structure of plan.structures) {
        for (const instanceId of getGardenStructurePlanBaselineVisiblePropInstanceIds(
            structure,
        )) {
            visiblePropInstanceIds.add(instanceId);
        }
    }
    return visiblePropInstanceIds;
}

export function getGardenStructureCollectionVisibleInstanceIndices(
    batch: GardenStructureCollectionBatchDescription,
    visibleStructureIds: ReadonlySet<string> | undefined,
    baselineVisiblePropInstanceIds: ReadonlySet<string> | undefined,
    admittedPropStructureIds: ReadonlySet<string> | undefined,
) {
    const filterPropVisibility =
        batch.category === 'props' &&
        (baselineVisiblePropInstanceIds !== undefined ||
            admittedPropStructureIds !== undefined);
    return batch.structureIds.flatMap((structureId, index) => {
        if (visibleStructureIds && !visibleStructureIds.has(structureId)) {
            return [];
        }
        if (!filterPropVisibility) {
            return [index];
        }
        const instanceId = batch.instanceIds[index];
        return (instanceId !== undefined &&
            baselineVisiblePropInstanceIds?.has(instanceId)) ||
            admittedPropStructureIds?.has(structureId)
            ? [index]
            : [];
    });
}

export function getGardenStructureCollectionVisibleBatches(
    batches: readonly GardenStructureCollectionBatchDescription[],
    visibleStructureIds: ReadonlySet<string> | undefined,
    baselineVisiblePropInstanceIds: ReadonlySet<string> | undefined,
    admittedPropStructureIds: ReadonlySet<string> | undefined,
) {
    return batches.filter(
        (batch) =>
            getGardenStructureCollectionVisibleInstanceIndices(
                batch,
                visibleStructureIds,
                baselineVisiblePropInstanceIds,
                admittedPropStructureIds,
            ).length > 0,
    );
}

function countVisibleProps(
    plan: GardenStructureCollectionPlan,
    visibleStructureIds: ReadonlySet<string>,
    baselineVisiblePropInstanceIds?: ReadonlySet<string>,
    admittedPropStructureIds?: ReadonlySet<string>,
) {
    return plan.batches.props.reduce(
        (total, batch) =>
            total +
            getGardenStructureCollectionVisibleInstanceIndices(
                batch,
                visibleStructureIds,
                baselineVisiblePropInstanceIds,
                admittedPropStructureIds,
            ).length,
        0,
    );
}

export function getGardenStructureSceneSubmissionMetrics({
    plan,
    baselineVisiblePropInstanceIds,
    renderProps,
    visibleInteriorStructureIds,
    visibleStructureIds,
}: Readonly<{
    plan: GardenStructureCollectionPlan;
    baselineVisiblePropInstanceIds: ReadonlySet<string>;
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
              baselineVisiblePropInstanceIds,
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
