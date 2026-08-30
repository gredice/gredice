import type {
    GardenStructureCoordinate,
    GardenStructureEdge,
    GardenStructureFootprintCell,
    GardenStructureRotation,
} from '@gredice/js/gardenStructures';
import {
    decodeGardenStructureDocument,
    gardenStructureCellKey,
    getGardenStructureAdjacentCells,
    rotateGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import { debugGardenStructureKitMetadata } from './debugStructureKit';
import { getGardenStructureDocumentFingerprint } from './gardenStructureDocumentFingerprint';
import type {
    GardenStructureBatchCategory,
    GardenStructureBatchDescription,
    GardenStructureBatchGeometryKind,
    GardenStructureBatchPlan,
    GardenStructureBlockedTransitionKind,
    GardenStructureBlockedTransitionPlan,
    GardenStructureCeilingProxies,
    GardenStructureCollisionBoxes,
    GardenStructureCompileInput,
    GardenStructureCompilerCounts,
    GardenStructureFloorPlan,
    GardenStructureFootprintPlan,
    GardenStructureHorizontalBounds,
    GardenStructureKitMetadata,
    GardenStructureMaterialTransparency,
    GardenStructureOpenPortalPlan,
    GardenStructurePackedCells,
    GardenStructureSemanticPlan,
    GardenStructureSpatialBucket,
    GardenStructureWalkablePlan,
    GardenStructureWorldBounds,
} from './structurePlanTypes';

type WorldCell = Readonly<{
    x: number;
    y: number;
}>;

type FootprintEntry = WorldCell &
    Readonly<{
        spaceKind: GardenStructureFootprintCell['spaceKind'];
    }>;

type FloorEntry = WorldCell &
    Readonly<{
        materialId: string;
    }>;

type BatchInstance = Readonly<{
    id: string;
    x: number;
    y: number;
    rotation: GardenStructureRotation;
}>;

type BatchBuilder = Readonly<{
    category: GardenStructureBatchCategory;
    geometryKind: GardenStructureBatchGeometryKind;
    geometryId: string;
    variantId?: string;
    materialId: string;
    transparency: GardenStructureMaterialTransparency;
    instances: BatchInstance[];
}>;

type EdgeGeometry = Readonly<{
    orientation: 'horizontal' | 'vertical';
    line: number;
    start: number;
    end: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    centerX: number;
    centerY: number;
    rotation: GardenStructureRotation;
}>;

type TransitionEntry = Readonly<{
    id: string;
    edgeId: string;
    partId: string;
    kind: GardenStructureBlockedTransitionKind | 'open-portal';
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    clearanceWidth: number;
    clearanceHeight: number;
}>;

type RawWallBox = Readonly<{
    kind: GardenStructureBlockedTransitionKind;
    sourceId: string;
    orientation: EdgeGeometry['orientation'];
    line: number;
    start: number;
    end: number;
    thickness: number;
    minHeight: number;
    maxHeight: number;
}>;

type MergedWallBox = Readonly<{
    kind: GardenStructureBlockedTransitionKind;
    sourceIds: readonly string[];
    orientation: EdgeGeometry['orientation'];
    line: number;
    start: number;
    end: number;
    thickness: number;
    minHeight: number;
    maxHeight: number;
}>;

type CeilingEntry = Readonly<{
    id: string;
    roofRegionId: string;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    minHeight: number;
    maxHeight: number;
}>;

type SpatialBucketBuilder = {
    x: number;
    y: number;
    walkableCellIndices: number[];
    floorIndices: number[];
    openPortalIndices: number[];
    blockedTransitionIndices: number[];
    wallBoxIndices: number[];
    propBoxIndices: number[];
    ceilingProxyIndices: number[];
};

const cellCoordinateStride = 2;
const transitionCoordinateStride = 4;
const collisionBoundsStride = 6;
const batchTransformStride = 3;
const mergeEpsilon = 0.000_001;

function compareCells(left: WorldCell, right: WorldCell) {
    return left.y - right.y || left.x - right.x;
}

function compareStrings(left: string, right: string) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function worldCellKey(cell: WorldCell) {
    return gardenStructureCellKey(cell);
}

function createIndexByKey(keys: readonly string[]) {
    return Object.freeze(
        Object.fromEntries(keys.map((key, index) => [key, index])),
    );
}

function createPackedCells(
    structureId: string,
    prefix: string,
    entries: readonly WorldCell[],
): GardenStructurePackedCells {
    const ids: string[] = [];
    const keys: string[] = [];
    const coordinates = new Int32Array(entries.length * cellCoordinateStride);

    for (const [index, entry] of entries.entries()) {
        const key = worldCellKey(entry);
        ids.push(`${prefix}:${structureId}:${key}`);
        keys.push(key);
        coordinates[index * cellCoordinateStride] = entry.x;
        coordinates[index * cellCoordinateStride + 1] = entry.y;
    }

    return {
        ids: Object.freeze(ids),
        coordinates,
        indexByKey: createIndexByKey(keys),
    };
}

function requiredMetadata<T>(
    record: Readonly<Record<string, T>>,
    id: string,
    metadataKind: string,
): T {
    const metadata = record[id];
    if (!metadata) {
        throw new Error(`Unknown ${metadataKind} "${id}".`);
    }
    return metadata;
}

function resolveMaterial(kit: GardenStructureKitMetadata, materialId: string) {
    return requiredMetadata(kit.materials, materialId, 'structure material');
}

function resolveEdgePart(
    kit: GardenStructureKitMetadata,
    edge: GardenStructureEdge,
) {
    const metadata = requiredMetadata(
        kit.edgeParts,
        edge.partId,
        'structure edge part',
    );
    if (metadata.edgeKind !== edge.kind) {
        throw new Error(
            `Structure edge "${edge.id}" uses ${edge.kind} with incompatible part "${edge.partId}".`,
        );
    }
    return metadata;
}

function createFootprintPlan(
    structureId: string,
    entries: readonly FootprintEntry[],
): GardenStructureFootprintPlan {
    const first = entries[0];
    if (!first) {
        throw new Error('A structure compiler input must have a footprint.');
    }

    let minX = first.x;
    let minY = first.y;
    let maxX = first.x;
    let maxY = first.y;
    const spaceKinds = new Uint8Array(entries.length);

    for (const [index, entry] of entries.entries()) {
        minX = Math.min(minX, entry.x);
        minY = Math.min(minY, entry.y);
        maxX = Math.max(maxX, entry.x);
        maxY = Math.max(maxY, entry.y);
        spaceKinds[index] = entry.spaceKind === 'interior' ? 0 : 1;
    }

    const bounds: GardenStructureHorizontalBounds = Object.freeze({
        minX: minX - 0.5,
        minY: minY - 0.5,
        maxX: maxX + 0.5,
        maxY: maxY + 0.5,
        width: maxX - minX + 1,
        depth: maxY - minY + 1,
    });

    return {
        ...createPackedCells(structureId, 'footprint', entries),
        spaceKinds,
        bounds,
    };
}

function createFloorPlan(
    structureId: string,
    entries: readonly FloorEntry[],
    baseHeight: number,
): GardenStructureFloorPlan {
    return {
        ...createPackedCells(structureId, 'floor', entries),
        materialIds: Object.freeze(entries.map((entry) => entry.materialId)),
        height: baseHeight,
    };
}

function createWalkablePlan(
    structureId: string,
    footprint: readonly FootprintEntry[],
    floorCellKeys: ReadonlySet<string>,
): GardenStructureWalkablePlan {
    const groundingKinds = new Uint8Array(footprint.length);
    for (const [index, cell] of footprint.entries()) {
        groundingKinds[index] = floorCellKeys.has(worldCellKey(cell)) ? 0 : 1;
    }

    return {
        ...createPackedCells(structureId, 'walkable', footprint),
        groundingKinds,
    };
}

function getEdgeGeometry(
    edge: GardenStructureEdge,
    anchorX: number,
    anchorY: number,
): EdgeGeometry {
    const fromX = edge.from.x + anchorX;
    const fromY = edge.from.y + anchorY;
    if (edge.direction === 'north') {
        return {
            orientation: 'horizontal',
            line: fromY - 0.5,
            start: fromX - 0.5,
            end: fromX + 0.5,
            startX: fromX - 0.5,
            startY: fromY - 0.5,
            endX: fromX + 0.5,
            endY: fromY - 0.5,
            centerX: fromX,
            centerY: fromY - 0.5,
            rotation: 0,
        };
    }

    return {
        orientation: 'vertical',
        line: fromX + 0.5,
        start: fromY - 0.5,
        end: fromY + 0.5,
        startX: fromX + 0.5,
        startY: fromY - 0.5,
        endX: fromX + 0.5,
        endY: fromY + 0.5,
        centerX: fromX + 0.5,
        centerY: fromY,
        rotation: 1,
    };
}

function getBlockedTransitionKind(
    edge: GardenStructureEdge,
): GardenStructureBlockedTransitionKind {
    if (edge.kind === 'door') {
        return 'closed-door';
    }
    return edge.kind;
}

function addBatchInstance(
    builders: Map<string, BatchBuilder>,
    description: Omit<BatchBuilder, 'instances'>,
    instance: BatchInstance,
) {
    const key = getBatchBuilderKey(description);
    const existing = builders.get(key);
    if (existing) {
        existing.instances.push(instance);
        return;
    }
    builders.set(key, { ...description, instances: [instance] });
}

function getBatchBuilderKey(description: Omit<BatchBuilder, 'instances'>) {
    return JSON.stringify([
        description.category,
        description.geometryKind,
        description.geometryId,
        description.variantId ?? null,
        description.materialId,
        description.transparency,
    ]);
}

function finishBatch(builder: BatchBuilder): GardenStructureBatchDescription {
    const instances = [...builder.instances].sort((left, right) =>
        compareStrings(left.id, right.id),
    );
    const transforms = new Float32Array(
        instances.length * batchTransformStride,
    );
    for (const [index, instance] of instances.entries()) {
        const offset = index * batchTransformStride;
        transforms[offset] = instance.x;
        transforms[offset + 1] = instance.y;
        transforms[offset + 2] = instance.rotation;
    }

    return Object.freeze({
        id: `batch:${getBatchBuilderKey(builder)}`,
        category: builder.category,
        geometryKind: builder.geometryKind,
        geometryId: builder.geometryId,
        ...(builder.variantId ? { variantId: builder.variantId } : {}),
        materialId: builder.materialId,
        transparency: builder.transparency,
        instanceIds: Object.freeze(instances.map((instance) => instance.id)),
        transformStride: 3,
        transforms,
    });
}

function finishBatches(builders: Map<string, BatchBuilder>) {
    return [...builders.values()]
        .map(finishBatch)
        .sort((left, right) => compareStrings(left.id, right.id));
}

function createBatchPlan(
    builders: Readonly<{
        opaque: Map<string, BatchBuilder>;
        transparent: Map<string, BatchBuilder>;
        roof: Map<string, BatchBuilder>;
        props: Map<string, BatchBuilder>;
    }>,
): GardenStructureBatchPlan {
    return Object.freeze({
        opaque: Object.freeze(finishBatches(builders.opaque)),
        transparent: Object.freeze(finishBatches(builders.transparent)),
        roof: Object.freeze(finishBatches(builders.roof)),
        props: Object.freeze(finishBatches(builders.props)),
    });
}

function createOpenPortalPlan(
    entries: readonly TransitionEntry[],
): GardenStructureOpenPortalPlan {
    const adjacentCells = new Int32Array(
        entries.length * transitionCoordinateStride,
    );
    const segments = new Float32Array(
        entries.length * transitionCoordinateStride,
    );
    const clearances = new Float32Array(entries.length * 2);

    for (const [index, entry] of entries.entries()) {
        const offset = index * transitionCoordinateStride;
        adjacentCells[offset] = entry.fromX;
        adjacentCells[offset + 1] = entry.fromY;
        adjacentCells[offset + 2] = entry.toX;
        adjacentCells[offset + 3] = entry.toY;
        segments[offset] = entry.startX;
        segments[offset + 1] = entry.startY;
        segments[offset + 2] = entry.endX;
        segments[offset + 3] = entry.endY;
        clearances[index * 2] = entry.clearanceWidth;
        clearances[index * 2 + 1] = entry.clearanceHeight;
    }

    return Object.freeze({
        ids: Object.freeze(entries.map((entry) => entry.id)),
        edgeIds: Object.freeze(entries.map((entry) => entry.edgeId)),
        partIds: Object.freeze(entries.map((entry) => entry.partId)),
        adjacentCells,
        segments,
        clearances,
    });
}

function createBlockedTransitionPlan(
    entries: readonly TransitionEntry[],
): GardenStructureBlockedTransitionPlan {
    const adjacentCells = new Int32Array(
        entries.length * transitionCoordinateStride,
    );
    const segments = new Float32Array(
        entries.length * transitionCoordinateStride,
    );

    for (const [index, entry] of entries.entries()) {
        const offset = index * transitionCoordinateStride;
        adjacentCells[offset] = entry.fromX;
        adjacentCells[offset + 1] = entry.fromY;
        adjacentCells[offset + 2] = entry.toX;
        adjacentCells[offset + 3] = entry.toY;
        segments[offset] = entry.startX;
        segments[offset + 1] = entry.startY;
        segments[offset + 2] = entry.endX;
        segments[offset + 3] = entry.endY;
    }

    return Object.freeze({
        ids: Object.freeze(entries.map((entry) => entry.id)),
        edgeIds: Object.freeze(entries.map((entry) => entry.edgeId)),
        partIds: Object.freeze(entries.map((entry) => entry.partId)),
        kinds: Object.freeze(
            entries.map((entry) => {
                if (entry.kind === 'open-portal') {
                    throw new Error(
                        'An open portal cannot be emitted as a blocked transition.',
                    );
                }
                return entry.kind;
            }),
        ),
        adjacentCells,
        segments,
    });
}

function compareRawWallBoxes(left: RawWallBox, right: RawWallBox) {
    return (
        compareStrings(left.kind, right.kind) ||
        compareStrings(left.orientation, right.orientation) ||
        left.line - right.line ||
        left.minHeight - right.minHeight ||
        left.maxHeight - right.maxHeight ||
        left.thickness - right.thickness ||
        left.start - right.start ||
        left.end - right.end ||
        compareStrings(left.sourceId, right.sourceId)
    );
}

function canMergeWallBoxes(left: MergedWallBox, right: RawWallBox) {
    return (
        left.kind === right.kind &&
        left.orientation === right.orientation &&
        left.line === right.line &&
        left.minHeight === right.minHeight &&
        left.maxHeight === right.maxHeight &&
        left.thickness === right.thickness &&
        right.start <= left.end + mergeEpsilon
    );
}

function mergeWallBoxes(
    rawBoxes: readonly RawWallBox[],
): readonly MergedWallBox[] {
    const result: MergedWallBox[] = [];
    for (const rawBox of [...rawBoxes].sort(compareRawWallBoxes)) {
        const previous = result.at(-1);
        if (!previous || !canMergeWallBoxes(previous, rawBox)) {
            result.push({
                ...rawBox,
                sourceIds: [rawBox.sourceId],
            });
            continue;
        }

        result[result.length - 1] = {
            ...previous,
            end: Math.max(previous.end, rawBox.end),
            sourceIds: [...previous.sourceIds, rawBox.sourceId],
        };
    }
    return result;
}

function createWallCollisionBoxes(
    structureId: string,
    rawBoxes: readonly RawWallBox[],
): GardenStructureCollisionBoxes {
    const merged = mergeWallBoxes(rawBoxes);
    const bounds = new Float32Array(merged.length * collisionBoundsStride);

    for (const [index, box] of merged.entries()) {
        const offset = index * collisionBoundsStride;
        if (box.orientation === 'horizontal') {
            bounds[offset] = box.start;
            bounds[offset + 1] = box.line - box.thickness / 2;
            bounds[offset + 2] = box.end;
            bounds[offset + 3] = box.line + box.thickness / 2;
        } else {
            bounds[offset] = box.line - box.thickness / 2;
            bounds[offset + 1] = box.start;
            bounds[offset + 2] = box.line + box.thickness / 2;
            bounds[offset + 3] = box.end;
        }
        bounds[offset + 4] = box.minHeight;
        bounds[offset + 5] = box.maxHeight;
    }

    return Object.freeze({
        ids: Object.freeze(
            merged.map(
                (box) =>
                    `collision:edge:${structureId}:${box.kind}:${box.orientation}:${box.line.toString()}:${box.start.toString()}-${box.end.toString()}`,
            ),
        ),
        kinds: Object.freeze(merged.map((box) => box.kind)),
        sourceIds: Object.freeze(
            merged.map((box) => Object.freeze([...box.sourceIds])),
        ),
        bounds,
    });
}

function createCeilingProxies(
    entries: readonly CeilingEntry[],
): GardenStructureCeilingProxies {
    const bounds = new Float32Array(entries.length * collisionBoundsStride);
    for (const [index, entry] of entries.entries()) {
        const offset = index * collisionBoundsStride;
        bounds[offset] = entry.minX;
        bounds[offset + 1] = entry.minY;
        bounds[offset + 2] = entry.maxX;
        bounds[offset + 3] = entry.maxY;
        bounds[offset + 4] = entry.minHeight;
        bounds[offset + 5] = entry.maxHeight;
    }
    return Object.freeze({
        ids: Object.freeze(entries.map((entry) => entry.id)),
        roofRegionIds: Object.freeze(
            entries.map((entry) => entry.roofRegionId),
        ),
        bounds,
    });
}

function createRoofCeilingEntries({
    structureId,
    regionId,
    cells,
    height,
    thickness,
}: {
    structureId: string;
    regionId: string;
    cells: readonly WorldCell[];
    height: number;
    thickness: number;
}) {
    const entries: CeilingEntry[] = [];
    const cellsByRow = new Map<number, number[]>();
    for (const cell of cells) {
        const row = cellsByRow.get(cell.y);
        if (row) {
            row.push(cell.x);
        } else {
            cellsByRow.set(cell.y, [cell.x]);
        }
    }

    for (const [y, unsortedXValues] of [...cellsByRow.entries()].sort(
        (left, right) => left[0] - right[0],
    )) {
        const xValues = [...unsortedXValues].sort(
            (left, right) => left - right,
        );
        let startX = xValues[0];
        let endX = xValues[0];
        if (startX === undefined || endX === undefined) {
            continue;
        }

        const emit = () => {
            entries.push({
                id: `ceiling:${structureId}:${regionId}:${y.toString()}:${startX.toString()}-${endX.toString()}`,
                roofRegionId: regionId,
                minX: startX - 0.5,
                minY: y - 0.5,
                maxX: endX + 0.5,
                maxY: y + 0.5,
                minHeight: height - thickness / 2,
                maxHeight: height + thickness / 2,
            });
        };

        for (const x of xValues.slice(1)) {
            if (x === endX + 1) {
                endX = x;
                continue;
            }
            emit();
            startX = x;
            endX = x;
        }
        emit();
    }

    return entries;
}

function uniqueSortedIndices(indices: readonly number[]) {
    return Uint32Array.from(
        [...new Set(indices)].sort((left, right) => left - right),
    );
}

function createSpatialBuckets({
    structureId,
    footprint,
    floors,
    openPortals,
    blockedTransitions,
    wallCollisionBoxes,
    propCollisionBoxes,
    ceilingProxies,
}: {
    structureId: string;
    footprint: readonly FootprintEntry[];
    floors: readonly FloorEntry[];
    openPortals: readonly TransitionEntry[];
    blockedTransitions: readonly TransitionEntry[];
    wallCollisionBoxes: GardenStructureCollisionBoxes;
    propCollisionBoxes: GardenStructureCollisionBoxes;
    ceilingProxies: GardenStructureCeilingProxies;
}) {
    const builders = new Map<string, SpatialBucketBuilder>();
    const ensureBucket = (x: number, y: number) => {
        const key = worldCellKey({ x, y });
        const existing = builders.get(key);
        if (existing) {
            return existing;
        }
        const created: SpatialBucketBuilder = {
            x,
            y,
            walkableCellIndices: [],
            floorIndices: [],
            openPortalIndices: [],
            blockedTransitionIndices: [],
            wallBoxIndices: [],
            propBoxIndices: [],
            ceilingProxyIndices: [],
        };
        builders.set(key, created);
        return created;
    };

    for (const [index, cell] of footprint.entries()) {
        ensureBucket(cell.x, cell.y).walkableCellIndices.push(index);
    }
    for (const [index, floor] of floors.entries()) {
        ensureBucket(floor.x, floor.y).floorIndices.push(index);
    }

    const addTransition = (
        entry: TransitionEntry,
        index: number,
        property: 'openPortalIndices' | 'blockedTransitionIndices',
    ) => {
        ensureBucket(entry.fromX, entry.fromY)[property].push(index);
        ensureBucket(entry.toX, entry.toY)[property].push(index);
    };
    for (const [index, entry] of openPortals.entries()) {
        addTransition(entry, index, 'openPortalIndices');
    }
    for (const [index, entry] of blockedTransitions.entries()) {
        addTransition(entry, index, 'blockedTransitionIndices');
    }

    const addBoxes = (
        boxes: GardenStructureCollisionBoxes | GardenStructureCeilingProxies,
        property: 'wallBoxIndices' | 'propBoxIndices' | 'ceilingProxyIndices',
    ) => {
        for (let index = 0; index < boxes.ids.length; index++) {
            const offset = index * collisionBoundsStride;
            const minX = boxes.bounds[offset];
            const minY = boxes.bounds[offset + 1];
            const maxX = boxes.bounds[offset + 2];
            const maxY = boxes.bounds[offset + 3];
            if (
                minX === undefined ||
                minY === undefined ||
                maxX === undefined ||
                maxY === undefined
            ) {
                continue;
            }
            const minCellX = Math.floor(minX + 0.5);
            const minCellY = Math.floor(minY + 0.5);
            const maxCellX = Math.ceil(maxX + 0.5) - 1;
            const maxCellY = Math.ceil(maxY + 0.5) - 1;
            for (let y = minCellY; y <= maxCellY; y++) {
                for (let x = minCellX; x <= maxCellX; x++) {
                    ensureBucket(x, y)[property].push(index);
                }
            }
        }
    };
    addBoxes(wallCollisionBoxes, 'wallBoxIndices');
    addBoxes(propCollisionBoxes, 'propBoxIndices');
    addBoxes(ceilingProxies, 'ceilingProxyIndices');

    const buckets: GardenStructureSpatialBucket[] = [...builders.entries()]
        .sort((left, right) => {
            const leftBucket = left[1];
            const rightBucket = right[1];
            return leftBucket.y - rightBucket.y || leftBucket.x - rightBucket.x;
        })
        .map(([key, bucket]) =>
            Object.freeze({
                id: `bucket:${structureId}:${key}`,
                key,
                x: bucket.x,
                y: bucket.y,
                walkableCellIndices: uniqueSortedIndices(
                    bucket.walkableCellIndices,
                ),
                floorIndices: uniqueSortedIndices(bucket.floorIndices),
                openPortalIndices: uniqueSortedIndices(
                    bucket.openPortalIndices,
                ),
                blockedTransitionIndices: uniqueSortedIndices(
                    bucket.blockedTransitionIndices,
                ),
                wallBoxIndices: uniqueSortedIndices(bucket.wallBoxIndices),
                propBoxIndices: uniqueSortedIndices(bucket.propBoxIndices),
                ceilingProxyIndices: uniqueSortedIndices(
                    bucket.ceilingProxyIndices,
                ),
            }),
        );
    const indexByKey = createIndexByKey(buckets.map((bucket) => bucket.key));
    return {
        buckets: Object.freeze(buckets),
        indexByKey,
    };
}

function countBatchInstances(batches: GardenStructureBatchPlan) {
    return [
        ...batches.opaque,
        ...batches.transparent,
        ...batches.roof,
        ...batches.props,
    ].reduce((total, batch) => total + batch.instanceIds.length, 0);
}

export function getGardenStructureCompilerCounts(
    plan: Omit<GardenStructureSemanticPlan, 'counts'>,
): GardenStructureCompilerCounts {
    const renderBatches =
        plan.batches.opaque.length +
        plan.batches.transparent.length +
        plan.batches.roof.length +
        plan.batches.props.length;

    return Object.freeze({
        footprintCells: plan.footprint.ids.length,
        floorSurfaces: plan.floors.ids.length,
        walkableCells: plan.walkable.ids.length,
        openPortals: plan.openPortals.ids.length,
        blockedTransitions: plan.blockedTransitions.ids.length,
        wallCollisionBoxes: plan.wallCollisionBoxes.ids.length,
        propCollisionBoxes: plan.propCollisionBoxes.ids.length,
        ceilingProxies: plan.ceilingProxies.ids.length,
        spatialBuckets: plan.spatialBuckets.length,
        opaqueBatches: plan.batches.opaque.length,
        transparentBatches: plan.batches.transparent.length,
        roofBatches: plan.batches.roof.length,
        propBatches: plan.batches.props.length,
        renderBatches,
        renderInstances: countBatchInstances(plan.batches),
        interactionIds: plan.interactionIds.length,
    });
}

function createWorldBounds({
    footprintBounds,
    baseHeight,
    kit,
    floorCount,
    maximumHeight,
    wallCollisionBoxes,
    propCollisionBoxes,
    ceilingProxies,
}: {
    footprintBounds: GardenStructureHorizontalBounds;
    baseHeight: number;
    kit: GardenStructureKitMetadata;
    floorCount: number;
    maximumHeight: number;
    wallCollisionBoxes: GardenStructureCollisionBoxes;
    propCollisionBoxes: GardenStructureCollisionBoxes;
    ceilingProxies: GardenStructureCeilingProxies;
}): GardenStructureWorldBounds {
    let minX = footprintBounds.minX - kit.visualHorizontalPadding;
    let minY = footprintBounds.minY - kit.visualHorizontalPadding;
    let maxX = footprintBounds.maxX + kit.visualHorizontalPadding;
    let maxY = footprintBounds.maxY + kit.visualHorizontalPadding;
    let minHeight =
        floorCount > 0 ? baseHeight - kit.floorThickness : baseHeight;
    let maxHeight = Math.max(baseHeight, maximumHeight);
    const includePackedBounds = (
        packedBounds: Float32Array,
        entryCount: number,
    ) => {
        for (let index = 0; index < entryCount; index += 1) {
            const offset = index * collisionBoundsStride;
            const candidateMinX = packedBounds[offset];
            const candidateMinY = packedBounds[offset + 1];
            const candidateMaxX = packedBounds[offset + 2];
            const candidateMaxY = packedBounds[offset + 3];
            const candidateMinHeight = packedBounds[offset + 4];
            const candidateMaxHeight = packedBounds[offset + 5];
            if (
                candidateMinX === undefined ||
                candidateMinY === undefined ||
                candidateMaxX === undefined ||
                candidateMaxY === undefined ||
                candidateMinHeight === undefined ||
                candidateMaxHeight === undefined
            ) {
                continue;
            }
            minX = Math.min(minX, candidateMinX);
            minY = Math.min(minY, candidateMinY);
            maxX = Math.max(maxX, candidateMaxX);
            maxY = Math.max(maxY, candidateMaxY);
            minHeight = Math.min(minHeight, candidateMinHeight);
            maxHeight = Math.max(maxHeight, candidateMaxHeight);
        }
    };
    includePackedBounds(
        wallCollisionBoxes.bounds,
        wallCollisionBoxes.ids.length,
    );
    includePackedBounds(
        propCollisionBoxes.bounds,
        propCollisionBoxes.ids.length,
    );
    includePackedBounds(ceilingProxies.bounds, ceilingProxies.ids.length);
    return Object.freeze({
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        depth: maxY - minY,
        minHeight,
        maxHeight,
        height: maxHeight - minHeight,
    });
}

export function getGardenStructurePlanCacheKey({
    structureId,
    revision,
    document,
    placement,
    kit = debugGardenStructureKitMetadata,
    baseHeight = 0,
}: GardenStructureCompileInput) {
    const documentFingerprint = getGardenStructureDocumentFingerprint(document);
    return [
        `structure=${structureId}`,
        `revision=${revision.toString()}`,
        `document=${documentFingerprint}`,
        `kit=${kit.kitKey}@${kit.kitVersion}`,
        `placement=${placement.anchorX.toString()},${placement.anchorY.toString()},${placement.rotation.toString()}`,
        `baseHeight=${baseHeight.toString()}`,
    ].join('|');
}

export function compileGardenStructurePlan({
    structureId,
    revision,
    document,
    placement,
    kit = debugGardenStructureKitMetadata,
    baseHeight = 0,
}: GardenStructureCompileInput): GardenStructureSemanticPlan {
    const decodedDocument = decodeGardenStructureDocument(document);
    if (!decodedDocument.valid) {
        const issueCodes = [
            ...new Set(decodedDocument.issues.map((issue) => issue.code)),
        ].join(', ');
        throw new Error(
            `Cannot compile an invalid garden structure document: ${issueCodes}.`,
        );
    }
    const canonicalDocument = decodedDocument.document;
    const rotated = rotateGardenStructureDocument(
        canonicalDocument,
        placement.rotation,
    );
    const footprintEntries = rotated.footprint.cells
        .map((cell) => ({
            x: cell.x + placement.anchorX,
            y: cell.y + placement.anchorY,
            spaceKind: cell.spaceKind,
        }))
        .sort(compareCells);
    const floorEntries = rotated.floors
        .map((floor) => ({
            x: floor.cell.x + placement.anchorX,
            y: floor.cell.y + placement.anchorY,
            materialId: floor.materialId,
        }))
        .sort(compareCells);

    const batchBuilders = {
        opaque: new Map<string, BatchBuilder>(),
        transparent: new Map<string, BatchBuilder>(),
        roof: new Map<string, BatchBuilder>(),
        props: new Map<string, BatchBuilder>(),
    };

    for (const floor of floorEntries) {
        const materialMetadata = resolveMaterial(kit, floor.materialId);
        const category = materialMetadata.transparency;
        addBatchInstance(
            batchBuilders[category],
            {
                category,
                geometryKind: 'floor-cell',
                geometryId: 'floor-cell',
                materialId: floor.materialId,
                transparency: materialMetadata.transparency,
            },
            {
                id: `floor:${structureId}:${worldCellKey(floor)}`,
                x: floor.x,
                y: floor.y,
                rotation: 0,
            },
        );
    }

    const openPortalEntries: TransitionEntry[] = [];
    const blockedTransitionEntries: TransitionEntry[] = [];
    const rawWallBoxes: RawWallBox[] = [];
    let maximumHeight = baseHeight;

    for (const edge of rotated.edges) {
        const part = resolveEdgePart(kit, edge);
        const material = resolveMaterial(kit, part.materialId);
        const geometry = getEdgeGeometry(
            edge,
            placement.anchorX,
            placement.anchorY,
        );
        const category = material.transparency;
        addBatchInstance(
            batchBuilders[category],
            {
                category,
                geometryKind: 'edge-segment',
                geometryId: edge.partId,
                materialId: part.materialId,
                transparency: material.transparency,
            },
            {
                id: `edge:${structureId}:${edge.id}`,
                x: geometry.centerX,
                y: geometry.centerY,
                rotation: geometry.rotation,
            },
        );

        const adjacent = getGardenStructureAdjacentCells(edge).map((cell) => ({
            x: cell.x + placement.anchorX,
            y: cell.y + placement.anchorY,
        }));
        const from = adjacent[0];
        const to = adjacent[1];
        if (!from || !to) {
            continue;
        }
        const isPortal = part.passage === 'open-portal';
        const transitionKind = isPortal
            ? 'open-portal'
            : getBlockedTransitionKind(edge);
        const transition: TransitionEntry = {
            id: `${isPortal ? 'portal' : 'blocked'}:${structureId}:${edge.id}`,
            edgeId: edge.id,
            partId: edge.partId,
            kind: transitionKind,
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            startX: geometry.startX,
            startY: geometry.startY,
            endX: geometry.endX,
            endY: geometry.endY,
            clearanceWidth: part.portalClearanceWidth ?? 0,
            clearanceHeight: part.portalClearanceHeight ?? 0,
        };
        if (isPortal) {
            openPortalEntries.push(transition);
        } else {
            blockedTransitionEntries.push(transition);
            rawWallBoxes.push({
                kind: getBlockedTransitionKind(edge),
                sourceId: edge.id,
                orientation: geometry.orientation,
                line: geometry.line,
                start: geometry.start,
                end: geometry.end,
                thickness: part.collisionThickness,
                minHeight: baseHeight,
                maxHeight: baseHeight + part.collisionHeight,
            });
        }
        maximumHeight = Math.max(
            maximumHeight,
            baseHeight + part.collisionHeight,
        );
    }

    openPortalEntries.sort((left, right) => compareStrings(left.id, right.id));
    blockedTransitionEntries.sort((left, right) =>
        compareStrings(left.id, right.id),
    );

    const ceilingEntries: CeilingEntry[] = [];
    for (const region of rotated.roofRegions) {
        const style = requiredMetadata(
            kit.roofStyles,
            region.styleId,
            'structure roof style',
        );
        const material = resolveMaterial(kit, region.materialId);
        const worldCells = region.cells
            .map((cell) => ({
                x: cell.x + placement.anchorX,
                y: cell.y + placement.anchorY,
            }))
            .sort(compareCells);
        for (const cell of worldCells) {
            addBatchInstance(
                batchBuilders.roof,
                {
                    category: 'roof',
                    geometryKind: 'roof-cell',
                    geometryId: region.styleId,
                    materialId: region.materialId,
                    transparency: material.transparency,
                },
                {
                    id: `roof:${structureId}:${region.id}:${worldCellKey(cell)}`,
                    x: cell.x,
                    y: cell.y,
                    rotation: region.rotation,
                },
            );
        }
        ceilingEntries.push(
            ...createRoofCeilingEntries({
                structureId,
                regionId: region.id,
                cells: worldCells,
                height: baseHeight + style.ceilingHeight,
                thickness: kit.ceilingThickness,
            }),
        );
        maximumHeight = Math.max(
            maximumHeight,
            baseHeight + style.maximumHeight,
        );
    }
    ceilingEntries.sort((left, right) => compareStrings(left.id, right.id));

    const propIds: string[] = [];
    const propKinds: 'prop'[] = [];
    const propSourceIds: (readonly string[])[] = [];
    const propBounds = new Float32Array(
        rotated.props.length * collisionBoundsStride,
    );
    for (const [index, prop] of rotated.props.entries()) {
        const part = requiredMetadata(
            kit.propParts,
            prop.partId,
            'structure prop part',
        );
        const material = resolveMaterial(kit, part.materialId);
        const worldX = prop.x + placement.anchorX;
        const worldY = prop.y + placement.anchorY;
        addBatchInstance(
            batchBuilders.props,
            {
                category: 'props',
                geometryKind: 'prop',
                geometryId: prop.partId,
                ...(prop.variantId ? { variantId: prop.variantId } : {}),
                materialId: part.materialId,
                transparency: material.transparency,
            },
            {
                id: `prop:${structureId}:${prop.id}`,
                x: worldX,
                y: worldY,
                rotation: prop.rotation,
            },
        );

        const swapAxes = prop.rotation === 1 || prop.rotation === 3;
        const width = swapAxes ? part.collisionDepth : part.collisionWidth;
        const depth = swapAxes ? part.collisionWidth : part.collisionDepth;
        const offset = index * collisionBoundsStride;
        propBounds[offset] = worldX - width / 2;
        propBounds[offset + 1] = worldY - depth / 2;
        propBounds[offset + 2] = worldX + width / 2;
        propBounds[offset + 3] = worldY + depth / 2;
        propBounds[offset + 4] = baseHeight;
        propBounds[offset + 5] = baseHeight + part.collisionHeight;
        propIds.push(`collision:prop:${structureId}:${prop.id}`);
        propKinds.push('prop');
        propSourceIds.push(Object.freeze([prop.id]));
        maximumHeight = Math.max(
            maximumHeight,
            baseHeight + part.collisionHeight,
        );
    }

    const propCollisionBoxes: GardenStructureCollisionBoxes = Object.freeze({
        ids: Object.freeze(propIds),
        kinds: Object.freeze(propKinds),
        sourceIds: Object.freeze(propSourceIds),
        bounds: propBounds,
    });
    const wallCollisionBoxes = createWallCollisionBoxes(
        structureId,
        rawWallBoxes,
    );
    const ceilingProxies = createCeilingProxies(ceilingEntries);
    const footprint = createFootprintPlan(structureId, footprintEntries);
    const floors = createFloorPlan(structureId, floorEntries, baseHeight);
    const floorCellKeys = new Set(floorEntries.map(worldCellKey));
    const walkable = createWalkablePlan(
        structureId,
        footprintEntries,
        floorCellKeys,
    );
    const openPortals = createOpenPortalPlan(openPortalEntries);
    const blockedTransitions = createBlockedTransitionPlan(
        blockedTransitionEntries,
    );
    const batches = createBatchPlan(batchBuilders);
    const spatial = createSpatialBuckets({
        structureId,
        footprint: footprintEntries,
        floors: floorEntries,
        openPortals: openPortalEntries,
        blockedTransitions: blockedTransitionEntries,
        wallCollisionBoxes,
        propCollisionBoxes,
        ceilingProxies,
    });
    const interactionIds = Object.freeze(
        [
            ...batches.opaque,
            ...batches.transparent,
            ...batches.roof,
            ...batches.props,
        ]
            .flatMap((batch) => batch.instanceIds)
            .sort(compareStrings),
    );
    const cacheKey = getGardenStructurePlanCacheKey({
        structureId,
        revision,
        document: canonicalDocument,
        placement,
        kit,
        baseHeight,
    });
    const withoutCounts = Object.freeze({
        id: `structure-plan:${structureId}:${revision.toString()}`,
        cacheKey,
        structureId,
        revision,
        kitKey: kit.kitKey,
        kitVersion: kit.kitVersion,
        placement: Object.freeze({ ...placement }),
        baseHeight,
        worldBounds: createWorldBounds({
            footprintBounds: footprint.bounds,
            baseHeight,
            kit,
            floorCount: floorEntries.length,
            maximumHeight,
            wallCollisionBoxes,
            propCollisionBoxes,
            ceilingProxies,
        }),
        footprint,
        floors,
        walkable,
        openPortals,
        blockedTransitions,
        wallCollisionBoxes,
        propCollisionBoxes,
        ceilingProxies,
        spatialBuckets: spatial.buckets,
        spatialBucketIndexByKey: spatial.indexByKey,
        batches,
        interactionIds,
    });

    return Object.freeze({
        ...withoutCounts,
        counts: getGardenStructureCompilerCounts(withoutCounts),
    });
}

export function containsGardenStructureWorldCell(
    plan: GardenStructureSemanticPlan,
    x: number,
    y: number,
) {
    const bounds = plan.footprint.bounds;
    if (
        x < bounds.minX ||
        x >= bounds.maxX ||
        y < bounds.minY ||
        y >= bounds.maxY
    ) {
        return false;
    }
    return Object.hasOwn(plan.footprint.indexByKey, worldCellKey({ x, y }));
}

export function containsGardenStructureWorldPoint(
    plan: GardenStructureSemanticPlan,
    x: number,
    y: number,
) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return false;
    }
    const bounds = plan.footprint.bounds;
    if (
        x < bounds.minX ||
        x >= bounds.maxX ||
        y < bounds.minY ||
        y >= bounds.maxY
    ) {
        return false;
    }
    return containsGardenStructureWorldCell(plan, Math.round(x), Math.round(y));
}

export function getGardenStructureNearbySpatialBuckets(
    plan: GardenStructureSemanticPlan,
    worldX: number,
    worldY: number,
    radius = 1,
) {
    const cellX = Math.round(worldX);
    const cellY = Math.round(worldY);
    const boundedRadius = Math.max(0, Math.floor(radius));
    const buckets: GardenStructureSpatialBucket[] = [];
    for (let y = cellY - boundedRadius; y <= cellY + boundedRadius; y++) {
        for (let x = cellX - boundedRadius; x <= cellX + boundedRadius; x++) {
            const index = plan.spatialBucketIndexByKey[worldCellKey({ x, y })];
            if (index === undefined) {
                continue;
            }
            const bucket = plan.spatialBuckets[index];
            if (bucket) {
                buckets.push(bucket);
            }
        }
    }
    return buckets;
}

export function getGardenStructurePackedCell(
    cells: GardenStructurePackedCells,
    index: number,
): GardenStructureCoordinate | undefined {
    const offset = index * cellCoordinateStride;
    const x = cells.coordinates[offset];
    const y = cells.coordinates[offset + 1];
    return x === undefined || y === undefined ? undefined : { x, y };
}

export function getGardenStructureCollisionBoxBounds(
    boxes: GardenStructureCollisionBoxes | GardenStructureCeilingProxies,
    index: number,
) {
    const offset = index * collisionBoundsStride;
    const minX = boxes.bounds[offset];
    const minY = boxes.bounds[offset + 1];
    const maxX = boxes.bounds[offset + 2];
    const maxY = boxes.bounds[offset + 3];
    const minHeight = boxes.bounds[offset + 4];
    const maxHeight = boxes.bounds[offset + 5];
    if (
        minX === undefined ||
        minY === undefined ||
        maxX === undefined ||
        maxY === undefined ||
        minHeight === undefined ||
        maxHeight === undefined
    ) {
        return undefined;
    }
    return { minX, minY, maxX, maxY, minHeight, maxHeight };
}
