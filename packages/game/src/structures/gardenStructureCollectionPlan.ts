import {
    type GardenStructureValidationIssue,
    gardenStructureMaxActivePerGarden,
} from '@gredice/js/gardenStructures';
import { compileGardenStructurePlan } from './compileGardenStructurePlan';
import { validateGardenStructureKitMetadata } from './gardenStructureKitMetadataValidation';
import { isGardenStructureKitV1DefinitionCompatible } from './gardenStructureKitV1Compatibility';
import {
    GardenStructurePlanCache,
    type GardenStructurePlanCacheOptions,
    getGardenStructureSemanticPlanEstimatedBytes,
} from './gardenStructurePlanCache';
import {
    decodeSavedGardenStructureRecord,
    type GardenStructureSavedRecordAdapterOptions,
    type GardenStructureSavedRecordFailure,
    type GardenStructureSavedRecordSuccess,
} from './gardenStructureSavedRecord';
import type {
    GardenStructureBatchCategory,
    GardenStructureBatchGeometryKind,
    GardenStructureKitMetadata,
    GardenStructureMaterialTransparency,
    GardenStructureSemanticPlan,
    GardenStructureSpatialBucket,
    GardenStructureWorldBounds,
} from './structurePlanTypes';

const collectionFingerprintVersion = 1;
const fnv1a64Offset = 0xcbf2_9ce4_8422_2325n;
const fnv1a64Prime = 0x0000_0100_0000_01b3n;
const uint64Mask = 0xffff_ffff_ffff_ffffn;
const sourceBatchTransformStride = 3;
const packedCellCoordinateStride = 2;
export const gardenStructureCollectionTransformStride = 4;
export const gardenStructureCollectionMaxStructureCount =
    gardenStructureMaxActivePerGarden;
export const gardenStructureCollectionCacheMaxEntryCount = 2;
export const gardenStructureCollectionCacheMaxEstimatedBytes = 24 * 1024 * 1024;

export type GardenStructureFallbackBoxGeometry = Readonly<{
    centerHeightOffset: number;
    depth: number;
    height: number;
    kind: 'box';
    width: number;
}>;

export type GardenStructureCollectionBatchDescription = Readonly<{
    category: GardenStructureBatchCategory;
    fallbackGeometry: GardenStructureFallbackBoxGeometry;
    geometryId: string;
    geometryKind: GardenStructureBatchGeometryKind;
    id: string;
    instanceIds: readonly string[];
    kitDefinitionFingerprint: string | null;
    kitKey: string;
    kitVersion: string;
    materialId: string;
    rendersSemanticFallback: boolean;
    structureIds: readonly string[];
    transformStride: typeof gardenStructureCollectionTransformStride;
    /** Packed as worldX, worldY/z, quarterTurns, baseHeight. */
    transforms: Float32Array;
    transparency: GardenStructureMaterialTransparency;
    variantId?: string;
}>;

export type GardenStructureCollectionBatches = Readonly<{
    opaque: readonly GardenStructureCollectionBatchDescription[];
    props: readonly GardenStructureCollectionBatchDescription[];
    roof: readonly GardenStructureCollectionBatchDescription[];
    transparent: readonly GardenStructureCollectionBatchDescription[];
}>;

export type GardenStructureCollectionSpatialEntry = Readonly<{
    bucketIndex: number;
    structureIndex: number;
}>;

export type GardenStructureCollectionSpatialBucket = Readonly<{
    entries: readonly GardenStructureCollectionSpatialEntry[];
    key: string;
    x: number;
    y: number;
}>;

export type GardenStructureCollectionPlan = Readonly<{
    batches: GardenStructureCollectionBatches;
    cacheKey: string;
    id: string;
    spatialBucketIndexByKey: Readonly<Record<string, number>>;
    spatialBuckets: readonly GardenStructureCollectionSpatialBucket[];
    structureIndexById: Readonly<Record<string, number>>;
    structurePlanKeys: readonly string[];
    structures: readonly GardenStructureSemanticPlan[];
    worldBounds: GardenStructureWorldBounds | null;
}>;

export type GardenStructureCollectionPlanEntry = Readonly<{
    kit: GardenStructureKitMetadata;
    plan: GardenStructureSemanticPlan;
}>;

export type GardenStructureCollectionWarning = Readonly<{
    structureId: string;
    warning: GardenStructureValidationIssue;
}>;

export type GardenStructureCollectionBuildResult = Readonly<{
    plan: GardenStructureCollectionPlan;
    rejectedRecords: readonly GardenStructureSavedRecordFailure[];
    warnings: readonly GardenStructureCollectionWarning[];
}>;

export type GardenStructureCollectionBuildOptions =
    GardenStructureSavedRecordAdapterOptions &
        Readonly<{
            maxStructureCount?: number;
            planCache?: GardenStructurePlanCache;
        }>;

export type GardenStructureCollectionVisibilityPredicate = (
    bounds: GardenStructureWorldBounds,
    structure: GardenStructureSemanticPlan,
) => boolean;

export type GardenStructureCollectionCacheDisposalReason =
    | 'cleared'
    | 'deleted'
    | 'evicted'
    | 'replaced';

export type GardenStructureCollectionCacheDispose = (
    plan: GardenStructureCollectionPlan,
    reason: GardenStructureCollectionCacheDisposalReason,
) => void;

export type GardenStructureCollectionCacheOptions = Readonly<{
    dispose?: GardenStructureCollectionCacheDispose;
    maxCollectionEntryCount?: number;
    maxCollectionEstimatedBytes?: number;
    maxStructureCount?: number;
    structurePlanCache?: GardenStructurePlanCacheOptions;
}>;

export type GardenStructureCollectionCacheSnapshot = Readonly<{
    disposalCount: number;
    entryCount: number;
    estimatedBytes: number;
    evictionCount: number;
    hitCount: number;
    maxCollectionEntryCount: number;
    maxCollectionEstimatedBytes: number;
    missCount: number;
    oversizeSkipCount: number;
    peakEstimatedBytes: number;
    structurePlanCache: ReturnType<GardenStructurePlanCache['snapshot']>;
    writeCount: number;
}>;

type CollectionBatchBuilder = {
    category: GardenStructureBatchCategory;
    fallbackGeometry: GardenStructureFallbackBoxGeometry;
    geometryId: string;
    geometryKind: GardenStructureBatchGeometryKind;
    instanceIds: string[];
    kitDefinitionFingerprint: string | null;
    kitKey: string;
    kitVersion: string;
    materialId: string;
    rendersSemanticFallback: boolean;
    structureIds: string[];
    transforms: number[];
    transparency: GardenStructureMaterialTransparency;
    variantId?: string;
};

type CollectionCacheEntry = Readonly<{
    estimatedBytes: number;
    plan: GardenStructureCollectionPlan;
}>;

function compareStrings(left: string, right: string) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function cellKey(x: number, y: number) {
    return `${x}|${y}`;
}

function fnv1a64(value: string) {
    let hash = fnv1a64Offset;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= BigInt(value.charCodeAt(index));
        hash = (hash * fnv1a64Prime) & uint64Mask;
    }
    return hash.toString(16).padStart(16, '0');
}

function requirePositiveSafeInteger(value: number, name: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive safe integer.`);
    }
    return value;
}

function sameStrings(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
    );
}

function getCollectionCacheKey(plans: readonly GardenStructureSemanticPlan[]) {
    const signature = plans.map((plan) => plan.cacheKey).join('\n');
    return `structure-collection:v${collectionFingerprintVersion.toString()}:${plans.length.toString(36)}:${fnv1a64(signature)}`;
}

function getFallbackGeometry(
    geometryKind: GardenStructureBatchGeometryKind,
    geometryId: string,
    kit: GardenStructureKitMetadata,
): GardenStructureFallbackBoxGeometry {
    switch (geometryKind) {
        case 'floor-cell':
            return Object.freeze({
                kind: 'box',
                centerHeightOffset: -kit.floorThickness / 2,
                width: 0.96,
                depth: 0.96,
                height: kit.floorThickness,
            });
        case 'edge-segment': {
            const edge = kit.edgeParts[geometryId];
            if (!edge) {
                throw new Error(
                    'Validated structure edge metadata became unavailable.',
                );
            }
            return Object.freeze({
                kind: 'box',
                centerHeightOffset: edge.collisionHeight / 2,
                width: 1,
                depth: edge.collisionThickness,
                height: edge.collisionHeight,
            });
        }
        case 'roof-cell': {
            const roof = kit.roofStyles[geometryId];
            if (!roof) {
                throw new Error(
                    'Validated structure roof metadata became unavailable.',
                );
            }
            const height = Math.max(
                kit.ceilingThickness,
                roof.maximumHeight - roof.ceilingHeight,
            );
            return Object.freeze({
                kind: 'box',
                centerHeightOffset: roof.ceilingHeight + height / 2,
                width: 1.04,
                depth: 1.04,
                height,
            });
        }
        case 'prop': {
            const prop = kit.propParts[geometryId];
            if (!prop) {
                throw new Error(
                    'Validated structure prop metadata became unavailable.',
                );
            }
            return Object.freeze({
                kind: 'box',
                centerHeightOffset: prop.collisionHeight / 2,
                width: prop.collisionWidth,
                depth: prop.collisionDepth,
                height: prop.collisionHeight,
            });
        }
    }
}

function rendersSemanticFallback(
    geometryKind: GardenStructureBatchGeometryKind,
    geometryId: string,
    kit: GardenStructureKitMetadata,
) {
    return !(
        geometryKind === 'edge-segment' &&
        kit.edgeParts[geometryId]?.passage === 'open-portal'
    );
}

const gardenStructureCollectionBatchChunkSize = 32;

function collectionBatchChunk(plan: GardenStructureSemanticPlan) {
    // Keep material batching local enough for the instanced mesh bounds to be
    // useful to Three's built-in frustum culling. A structure is never split
    // across chunks, so its parts still appear and disappear together.
    return Object.freeze({
        x: Math.round(
            (plan.worldBounds.minX + plan.worldBounds.maxX) /
                2 /
                gardenStructureCollectionBatchChunkSize,
        ),
        y: Math.round(
            (plan.worldBounds.minY + plan.worldBounds.maxY) /
                2 /
                gardenStructureCollectionBatchChunkSize,
        ),
    });
}

function collectionBatchKey(
    plan: GardenStructureSemanticPlan,
    batch: GardenStructureSemanticPlan['batches']['opaque'][number],
) {
    const chunk = collectionBatchChunk(plan);
    return [
        plan.kitKey,
        plan.kitVersion,
        plan.kitDefinitionFingerprint ?? 'invalid-kit-definition',
        chunk.x,
        chunk.y,
        batch.category,
        batch.geometryKind,
        batch.geometryId,
        batch.variantId ?? '',
        batch.materialId,
        batch.transparency,
    ].join('|');
}

function createCollectionBatches(
    entries: readonly GardenStructureCollectionPlanEntry[],
): GardenStructureCollectionBatches {
    const builders = new Map<string, CollectionBatchBuilder>();
    for (const { kit, plan } of entries) {
        let emittedInstanceCount = 0;
        let emittedSemanticFallbackInstanceCount = 0;
        const planBatches = [
            ...plan.batches.opaque,
            ...plan.batches.transparent,
            ...plan.batches.roof,
            ...plan.batches.props,
        ];
        for (const batch of planBatches) {
            const key = collectionBatchKey(plan, batch);
            let builder = builders.get(key);
            if (!builder) {
                builder = {
                    category: batch.category,
                    geometryKind: batch.geometryKind,
                    geometryId: batch.geometryId,
                    ...(batch.variantId ? { variantId: batch.variantId } : {}),
                    materialId: batch.materialId,
                    rendersSemanticFallback: rendersSemanticFallback(
                        batch.geometryKind,
                        batch.geometryId,
                        kit,
                    ),
                    transparency: batch.transparency,
                    kitKey: plan.kitKey,
                    kitVersion: plan.kitVersion,
                    kitDefinitionFingerprint: plan.kitDefinitionFingerprint,
                    fallbackGeometry: getFallbackGeometry(
                        batch.geometryKind,
                        batch.geometryId,
                        kit,
                    ),
                    instanceIds: [],
                    structureIds: [],
                    transforms: [],
                };
                builders.set(key, builder);
            }

            for (const [
                instanceIndex,
                instanceId,
            ] of batch.instanceIds.entries()) {
                const offset = instanceIndex * sourceBatchTransformStride;
                const x = batch.transforms[offset];
                const y = batch.transforms[offset + 1];
                const rotation = batch.transforms[offset + 2];
                if (
                    x === undefined ||
                    y === undefined ||
                    rotation === undefined
                ) {
                    throw new Error('Structure batch transform is incomplete.');
                }
                builder.instanceIds.push(instanceId);
                builder.structureIds.push(plan.structureId);
                builder.transforms.push(x, y, rotation, plan.baseHeight);
                emittedInstanceCount += 1;
                if (builder.rendersSemanticFallback) {
                    emittedSemanticFallbackInstanceCount += 1;
                }
            }
        }

        if (
            emittedInstanceCount === 0 ||
            (!isGardenStructureKitV1DefinitionCompatible(plan) &&
                emittedSemanticFallbackInstanceCount === 0)
        ) {
            const chunk = collectionBatchChunk(plan);
            const key = [
                plan.kitKey,
                plan.kitVersion,
                plan.kitDefinitionFingerprint ?? 'invalid-kit-definition',
                chunk.x,
                chunk.y,
                'transparent',
                'floor-cell',
                'semantic-footprint',
                '',
                'semantic-footprint',
                'transparent',
            ].join('|');
            let builder = builders.get(key);
            if (!builder) {
                builder = {
                    category: 'transparent',
                    geometryKind: 'floor-cell',
                    geometryId: 'semantic-footprint',
                    materialId: 'semantic-footprint',
                    rendersSemanticFallback: true,
                    transparency: 'transparent',
                    kitKey: plan.kitKey,
                    kitVersion: plan.kitVersion,
                    kitDefinitionFingerprint: plan.kitDefinitionFingerprint,
                    fallbackGeometry: Object.freeze({
                        kind: 'box',
                        centerHeightOffset: 0.0125,
                        width: 0.9,
                        depth: 0.9,
                        height: 0.025,
                    }),
                    instanceIds: [],
                    structureIds: [],
                    transforms: [],
                };
                builders.set(key, builder);
            }
            for (const [index, instanceId] of plan.footprint.ids.entries()) {
                const offset = index * packedCellCoordinateStride;
                const x = plan.footprint.coordinates[offset];
                const y = plan.footprint.coordinates[offset + 1];
                if (x === undefined || y === undefined) {
                    throw new Error(
                        'Structure footprint transform is incomplete.',
                    );
                }
                builder.instanceIds.push(instanceId);
                builder.structureIds.push(plan.structureId);
                builder.transforms.push(x, y, 0, plan.baseHeight);
            }
        }
    }

    const grouped: Record<
        GardenStructureBatchCategory,
        GardenStructureCollectionBatchDescription[]
    > = { opaque: [], transparent: [], roof: [], props: [] };
    for (const [key, builder] of [...builders.entries()].sort(
        ([left], [right]) => compareStrings(left, right),
    )) {
        grouped[builder.category].push(
            Object.freeze({
                id: `structure-collection-batch:${key}`,
                category: builder.category,
                geometryKind: builder.geometryKind,
                geometryId: builder.geometryId,
                ...(builder.variantId ? { variantId: builder.variantId } : {}),
                materialId: builder.materialId,
                rendersSemanticFallback: builder.rendersSemanticFallback,
                transparency: builder.transparency,
                kitKey: builder.kitKey,
                kitVersion: builder.kitVersion,
                kitDefinitionFingerprint: builder.kitDefinitionFingerprint,
                fallbackGeometry: builder.fallbackGeometry,
                instanceIds: Object.freeze(builder.instanceIds),
                structureIds: Object.freeze(builder.structureIds),
                transformStride: gardenStructureCollectionTransformStride,
                transforms: new Float32Array(builder.transforms),
            }),
        );
    }

    return Object.freeze({
        opaque: Object.freeze(grouped.opaque),
        transparent: Object.freeze(grouped.transparent),
        roof: Object.freeze(grouped.roof),
        props: Object.freeze(grouped.props),
    });
}

function createCollectionSpatialBuckets(
    structures: readonly GardenStructureSemanticPlan[],
) {
    const builders = new Map<
        string,
        {
            entries: GardenStructureCollectionSpatialEntry[];
            x: number;
            y: number;
        }
    >();
    for (const [structureIndex, structure] of structures.entries()) {
        for (const [
            bucketIndex,
            bucket,
        ] of structure.spatialBuckets.entries()) {
            let builder = builders.get(bucket.key);
            if (!builder) {
                builder = { x: bucket.x, y: bucket.y, entries: [] };
                builders.set(bucket.key, builder);
            }
            builder.entries.push({ structureIndex, bucketIndex });
        }
    }

    const buckets = [...builders.entries()]
        .map(([key, builder]) =>
            Object.freeze({
                key,
                x: builder.x,
                y: builder.y,
                entries: Object.freeze(
                    builder.entries.sort(
                        (left, right) =>
                            left.structureIndex - right.structureIndex ||
                            left.bucketIndex - right.bucketIndex,
                    ),
                ),
            }),
        )
        .sort((left, right) => left.y - right.y || left.x - right.x);
    return {
        buckets: Object.freeze(buckets),
        indexByKey: Object.freeze(
            Object.fromEntries(
                buckets.map((bucket, index) => [bucket.key, index]),
            ),
        ),
    };
}

function createCollectionWorldBounds(
    structures: readonly GardenStructureSemanticPlan[],
) {
    const first = structures[0]?.worldBounds;
    if (!first) {
        return null;
    }
    let minX = first.minX;
    let minY = first.minY;
    let maxX = first.maxX;
    let maxY = first.maxY;
    let minHeight = first.minHeight;
    let maxHeight = first.maxHeight;
    for (const structure of structures.slice(1)) {
        const bounds = structure.worldBounds;
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
        minHeight = Math.min(minHeight, bounds.minHeight);
        maxHeight = Math.max(maxHeight, bounds.maxHeight);
    }
    return Object.freeze({
        minX,
        minY,
        maxX,
        maxY,
        minHeight,
        maxHeight,
        width: maxX - minX,
        depth: maxY - minY,
        height: maxHeight - minHeight,
    });
}

export function createGardenStructureCollectionPlan(
    inputEntries: readonly GardenStructureCollectionPlanEntry[],
): GardenStructureCollectionPlan {
    const entries = inputEntries
        .map(({ kit, plan }) => {
            const kitValidation = validateGardenStructureKitMetadata(kit);
            if (
                plan.runtimeSafety.collisionMode === 'semantic' &&
                (!kitValidation.valid ||
                    !kitValidation.identity ||
                    !kitValidation.kitDefinitionFingerprint ||
                    !kitValidation.metadataSnapshot ||
                    kitValidation.identity.kitKey !== plan.kitKey ||
                    kitValidation.identity.kitVersion !== plan.kitVersion ||
                    kitValidation.kitDefinitionFingerprint !==
                        plan.kitDefinitionFingerprint)
            ) {
                throw new Error(
                    'A structure collection entry must use its compiled immutable kit definition.',
                );
            }
            return Object.freeze({
                kit: kitValidation.metadataSnapshot ?? kit,
                plan,
            });
        })
        .sort((left, right) =>
            compareStrings(left.plan.structureId, right.plan.structureId),
        );
    const structureIds = new Set<string>();
    for (const { plan } of entries) {
        if (structureIds.has(plan.structureId)) {
            throw new Error(
                'A structure collection cannot contain duplicate structure IDs.',
            );
        }
        structureIds.add(plan.structureId);
    }
    const structures = Object.freeze(entries.map(({ plan }) => plan));
    const structurePlanKeys = Object.freeze(
        structures.map((structure) => structure.cacheKey),
    );
    const cacheKey = getCollectionCacheKey(structures);
    const spatial = createCollectionSpatialBuckets(structures);
    return Object.freeze({
        id: cacheKey,
        cacheKey,
        structures,
        structurePlanKeys,
        structureIndexById: Object.freeze(
            Object.fromEntries(
                structures.map((structure, index) => [
                    structure.structureId,
                    index,
                ]),
            ),
        ),
        batches: createCollectionBatches(entries),
        spatialBuckets: spatial.buckets,
        spatialBucketIndexByKey: spatial.indexByKey,
        worldBounds: createCollectionWorldBounds(structures),
    });
}

function duplicateFailure(
    structureId: string,
): GardenStructureSavedRecordFailure {
    return Object.freeze({
        valid: false,
        structureId,
        issues: Object.freeze([
            Object.freeze({
                code: 'invalid-record' as const,
                path: 'id',
                message: 'Saved garden structure IDs must be unique.',
            }),
        ]),
    });
}

function compileFailure(
    structureId: string,
): GardenStructureSavedRecordFailure {
    return Object.freeze({
        valid: false,
        structureId,
        issues: Object.freeze([
            Object.freeze({
                code: 'kit-metadata-incomplete' as const,
                path: 'document',
                message:
                    'The validated structure could not be compiled safely.',
            }),
        ]),
    });
}

function compareFailures(
    left: GardenStructureSavedRecordFailure,
    right: GardenStructureSavedRecordFailure,
) {
    return compareStrings(left.structureId ?? '', right.structureId ?? '');
}

type PreparedGardenStructureCollection = Readonly<{
    entries: readonly GardenStructureCollectionPlanEntry[];
    rejectedRecords: readonly GardenStructureSavedRecordFailure[];
    warnings: readonly GardenStructureCollectionWarning[];
}>;

function prepareSavedGardenStructureCollection(
    records: readonly unknown[],
    options: GardenStructureCollectionBuildOptions = {},
): PreparedGardenStructureCollection {
    const maximum = requirePositiveSafeInteger(
        options.maxStructureCount ?? gardenStructureCollectionMaxStructureCount,
        'maxStructureCount',
    );
    if (records.length > maximum) {
        throw new RangeError(
            `A garden structure collection may contain at most ${maximum.toString()} records.`,
        );
    }

    const decoded = records.map((record) =>
        decodeSavedGardenStructureRecord(record, options),
    );
    const rejectedRecords = decoded.filter(
        (result): result is GardenStructureSavedRecordFailure => !result.valid,
    );
    const valid = decoded.filter(
        (result): result is GardenStructureSavedRecordSuccess => result.valid,
    );
    const counts = new Map<string, number>();
    for (const result of valid) {
        counts.set(
            result.structureId,
            (counts.get(result.structureId) ?? 0) + 1,
        );
    }

    const unique = valid
        .filter((result) => {
            if (counts.get(result.structureId) === 1) {
                return true;
            }
            rejectedRecords.push(duplicateFailure(result.structureId));
            return false;
        })
        .sort((left, right) =>
            compareStrings(left.structureId, right.structureId),
        );
    const entries: GardenStructureCollectionPlanEntry[] = [];
    const warnings: GardenStructureCollectionWarning[] = [];
    for (const result of unique) {
        try {
            const plan = options.planCache
                ? options.planCache.getOrCompile(result.input)
                : compileGardenStructurePlan(result.input);
            entries.push({ kit: result.input.kit, plan });
            warnings.push(
                ...result.warnings.map((warning) => ({
                    structureId: result.structureId,
                    warning,
                })),
            );
        } catch {
            rejectedRecords.push(compileFailure(result.structureId));
        }
    }

    return Object.freeze({
        entries: Object.freeze(entries),
        rejectedRecords: Object.freeze(rejectedRecords.sort(compareFailures)),
        warnings: Object.freeze(
            warnings.sort(
                (left, right) =>
                    compareStrings(left.structureId, right.structureId) ||
                    compareStrings(left.warning.path, right.warning.path),
            ),
        ),
    });
}

function collectionBuildResult(
    prepared: PreparedGardenStructureCollection,
    plan: GardenStructureCollectionPlan,
): GardenStructureCollectionBuildResult {
    return Object.freeze({
        plan,
        rejectedRecords: prepared.rejectedRecords,
        warnings: prepared.warnings,
    });
}

export function compileSavedGardenStructureCollection(
    records: readonly unknown[],
    options: GardenStructureCollectionBuildOptions = {},
): GardenStructureCollectionBuildResult {
    const prepared = prepareSavedGardenStructureCollection(records, options);
    return collectionBuildResult(
        prepared,
        createGardenStructureCollectionPlan(prepared.entries),
    );
}

export function getVisibleGardenStructureIds(
    plan: GardenStructureCollectionPlan,
    isVisible: GardenStructureCollectionVisibilityPredicate,
) {
    return new Set(
        plan.structures
            .filter((structure) => isVisible(structure.worldBounds, structure))
            .map((structure) => structure.structureId),
    );
}

export function getNearbyGardenStructureCollectionBuckets(
    plan: GardenStructureCollectionPlan,
    worldX: number,
    worldY: number,
    radius = 1,
): readonly GardenStructureCollectionSpatialBucket[] {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
        return [];
    }
    const centerX = Math.round(worldX);
    const centerY = Math.round(worldY);
    const boundedRadius = Math.min(4, Math.max(0, Math.floor(radius)));
    const buckets: GardenStructureCollectionSpatialBucket[] = [];
    for (
        let y = centerY - boundedRadius;
        y <= centerY + boundedRadius;
        y += 1
    ) {
        for (
            let x = centerX - boundedRadius;
            x <= centerX + boundedRadius;
            x += 1
        ) {
            const index = plan.spatialBucketIndexByKey[cellKey(x, y)];
            const bucket =
                index === undefined ? undefined : plan.spatialBuckets[index];
            if (bucket) {
                buckets.push(bucket);
            }
        }
    }
    return buckets;
}

export function resolveGardenStructureCollectionSpatialEntry(
    plan: GardenStructureCollectionPlan,
    entry: GardenStructureCollectionSpatialEntry,
): Readonly<{
    bucket: GardenStructureSpatialBucket;
    structure: GardenStructureSemanticPlan;
}> | null {
    const structure = plan.structures[entry.structureIndex];
    const bucket = structure?.spatialBuckets[entry.bucketIndex];
    return structure && bucket ? { structure, bucket } : null;
}

export function getGardenStructureCollectionPlanEstimatedBytes(
    plan: GardenStructureCollectionPlan,
) {
    const stringBytes = (value: string) => value.length * 2 + 16;
    const batchBytes = [
        ...plan.batches.opaque,
        ...plan.batches.transparent,
        ...plan.batches.roof,
        ...plan.batches.props,
    ].reduce(
        (total, batch) =>
            total +
            batch.transforms.byteLength +
            batch.instanceIds.reduce(
                (sum, value) => sum + stringBytes(value),
                0,
            ) +
            batch.structureIds.reduce(
                (sum, value) => sum + stringBytes(value),
                0,
            ) +
            256,
        0,
    );
    const spatialBytes = plan.spatialBuckets.reduce(
        (total, bucket) => total + 96 + bucket.entries.length * 16,
        0,
    );
    return (
        256 +
        stringBytes(plan.cacheKey) +
        batchBytes +
        spatialBytes +
        plan.structures.reduce(
            (total, structure) =>
                total + getGardenStructureSemanticPlanEstimatedBytes(structure),
            0,
        )
    );
}

export class GardenStructureCollectionCache {
    private readonly entries = new Map<string, CollectionCacheEntry>();
    private readonly disposeCollection:
        | GardenStructureCollectionCacheDispose
        | undefined;
    private readonly maxCollectionEntryCount: number;
    private readonly maxCollectionEstimatedBytes: number;
    private readonly maxStructureCount: number;
    private readonly structurePlanCache: GardenStructurePlanCache;
    private disposalCount = 0;
    private estimatedBytes = 0;
    private evictionCount = 0;
    private hitCount = 0;
    private missCount = 0;
    private oversizeSkipCount = 0;
    private peakEstimatedBytes = 0;
    private writeCount = 0;

    constructor(options: GardenStructureCollectionCacheOptions = {}) {
        this.maxCollectionEntryCount = requirePositiveSafeInteger(
            options.maxCollectionEntryCount ??
                gardenStructureCollectionCacheMaxEntryCount,
            'maxCollectionEntryCount',
        );
        this.maxCollectionEstimatedBytes = requirePositiveSafeInteger(
            options.maxCollectionEstimatedBytes ??
                gardenStructureCollectionCacheMaxEstimatedBytes,
            'maxCollectionEstimatedBytes',
        );
        this.maxStructureCount = requirePositiveSafeInteger(
            options.maxStructureCount ??
                gardenStructureCollectionMaxStructureCount,
            'maxStructureCount',
        );
        this.disposeCollection = options.dispose;
        this.structurePlanCache = new GardenStructurePlanCache({
            maxEntryCount: this.maxStructureCount,
            maxEstimatedBytes: 16 * 1024 * 1024,
            ...options.structurePlanCache,
        });
    }

    get(key: string, structurePlanKeys?: readonly string[]) {
        const entry = this.entries.get(key);
        if (
            !entry ||
            (structurePlanKeys &&
                !sameStrings(entry.plan.structurePlanKeys, structurePlanKeys))
        ) {
            this.missCount += 1;
            return undefined;
        }
        this.entries.delete(key);
        this.entries.set(key, entry);
        this.hitCount += 1;
        return entry.plan;
    }

    getOrCompile(
        records: readonly unknown[],
        options: GardenStructureSavedRecordAdapterOptions = {},
    ): GardenStructureCollectionBuildResult {
        const prepared = prepareSavedGardenStructureCollection(records, {
            ...options,
            maxStructureCount: this.maxStructureCount,
            planCache: this.structurePlanCache,
        });
        const structures = prepared.entries.map(({ plan }) => plan);
        const structurePlanKeys = structures.map(({ cacheKey }) => cacheKey);
        const cacheKey = getCollectionCacheKey(structures);
        const cached = this.get(cacheKey, structurePlanKeys);
        if (cached) {
            return collectionBuildResult(prepared, cached);
        }
        const plan = createGardenStructureCollectionPlan(prepared.entries);
        this.set(plan);
        return collectionBuildResult(prepared, plan);
    }

    set(plan: GardenStructureCollectionPlan) {
        const estimatedBytes =
            getGardenStructureCollectionPlanEstimatedBytes(plan);
        if (estimatedBytes > this.maxCollectionEstimatedBytes) {
            this.oversizeSkipCount += 1;
            return false;
        }

        const existing = this.entries.get(plan.cacheKey);
        if (existing?.plan === plan) {
            this.entries.delete(plan.cacheKey);
            this.entries.set(plan.cacheKey, existing);
            return true;
        }
        if (existing) {
            this.remove(plan.cacheKey, 'replaced');
        }
        while (
            this.entries.size >= this.maxCollectionEntryCount ||
            this.estimatedBytes + estimatedBytes >
                this.maxCollectionEstimatedBytes
        ) {
            const oldestKey = this.entries.keys().next().value;
            if (typeof oldestKey !== 'string') {
                break;
            }
            this.remove(oldestKey, 'evicted');
            this.evictionCount += 1;
        }

        this.entries.set(plan.cacheKey, { plan, estimatedBytes });
        this.estimatedBytes += estimatedBytes;
        this.peakEstimatedBytes = Math.max(
            this.peakEstimatedBytes,
            this.estimatedBytes,
        );
        this.writeCount += 1;
        return true;
    }

    delete(key: string) {
        return this.remove(key, 'deleted');
    }

    clear() {
        for (const key of [...this.entries.keys()]) {
            this.remove(key, 'cleared');
        }
        this.structurePlanCache.clear();
    }

    dispose() {
        this.clear();
    }

    snapshot(): GardenStructureCollectionCacheSnapshot {
        return {
            entryCount: this.entries.size,
            estimatedBytes: this.estimatedBytes,
            maxCollectionEntryCount: this.maxCollectionEntryCount,
            maxCollectionEstimatedBytes: this.maxCollectionEstimatedBytes,
            hitCount: this.hitCount,
            missCount: this.missCount,
            writeCount: this.writeCount,
            evictionCount: this.evictionCount,
            oversizeSkipCount: this.oversizeSkipCount,
            disposalCount: this.disposalCount,
            peakEstimatedBytes: this.peakEstimatedBytes,
            structurePlanCache: this.structurePlanCache.snapshot(),
        };
    }

    private remove(
        key: string,
        reason: GardenStructureCollectionCacheDisposalReason,
    ) {
        const entry = this.entries.get(key);
        if (!entry) {
            return false;
        }
        this.entries.delete(key);
        this.estimatedBytes -= entry.estimatedBytes;
        if (this.disposeCollection) {
            this.disposeCollection(entry.plan, reason);
            this.disposalCount += 1;
        }
        return true;
    }
}
