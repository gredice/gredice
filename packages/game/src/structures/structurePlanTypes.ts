import type {
    GardenStructureDocumentV1,
    GardenStructurePlacement,
    GardenStructureRotation,
} from '@gredice/js/gardenStructures';
import type { GardenStructureKitMetadataIssue } from './gardenStructureKitMetadataValidation';

export type GardenStructureMaterialTransparency = 'opaque' | 'transparent';

export type GardenStructureMaterialMetadata = Readonly<{
    transparency: GardenStructureMaterialTransparency;
}>;

export type GardenStructureEdgePartMetadata = Readonly<{
    edgeKind: 'wall' | 'door' | 'window';
    materialId: string;
    passage: 'solid' | 'open-portal';
    collisionHeight: number;
    collisionThickness: number;
    portalClearanceHeight?: number;
    portalClearanceWidth?: number;
}>;

export type GardenStructurePropPartMetadata = Readonly<{
    materialId: string;
    collisionWidth: number;
    collisionDepth: number;
    collisionHeight: number;
}>;

export type GardenStructureRoofStyleMetadata = Readonly<{
    ceilingHeight: number;
    maximumHeight: number;
}>;

/**
 * Renderer-independent metadata. Published kits can later provide the same
 * contract without placing asset URLs, GLB nodes, or Three.js objects in a
 * semantic plan.
 */
export type GardenStructureKitMetadata = Readonly<{
    kitKey: string;
    kitVersion: string;
    floorThickness: number;
    ceilingThickness: number;
    /** Conservative horizontal extent beyond the owning cell/edge bounds. */
    visualHorizontalPadding: number;
    materials: Readonly<Record<string, GardenStructureMaterialMetadata>>;
    edgeParts: Readonly<Record<string, GardenStructureEdgePartMetadata>>;
    propParts: Readonly<Record<string, GardenStructurePropPartMetadata>>;
    roofStyles: Readonly<Record<string, GardenStructureRoofStyleMetadata>>;
}>;

export type GardenStructureCompileInput = Readonly<{
    structureId: string;
    revision: number;
    document: GardenStructureDocumentV1;
    placement: GardenStructurePlacement;
    kit?: GardenStructureKitMetadata;
    baseHeight?: number;
}>;

export type GardenStructureHorizontalBounds = Readonly<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    depth: number;
}>;

export type GardenStructureWorldBounds = GardenStructureHorizontalBounds &
    Readonly<{
        minHeight: number;
        maxHeight: number;
        height: number;
    }>;

/** Coordinates use packed world-grid x/y pairs. */
export type GardenStructurePackedCells = Readonly<{
    ids: readonly string[];
    coordinates: Int32Array;
    indexByKey: Readonly<Record<string, number>>;
}>;

export type GardenStructureFootprintPlan = GardenStructurePackedCells &
    Readonly<{
        /** 0 = interior, 1 = covered outdoor. */
        spaceKinds: Uint8Array;
        bounds: GardenStructureHorizontalBounds;
    }>;

export type GardenStructureFloorPlan = GardenStructurePackedCells &
    Readonly<{
        materialIds: readonly string[];
        height: number;
    }>;

export type GardenStructureWalkablePlan = GardenStructurePackedCells &
    Readonly<{
        /** 0 = explicit structure floor, 1 = underlying terrain/support. */
        groundingKinds: Uint8Array;
    }>;

export type GardenStructureOpenPortalPlan = Readonly<{
    ids: readonly string[];
    edgeIds: readonly string[];
    partIds: readonly string[];
    /** Packed as fromX, fromY, toX, toY. */
    adjacentCells: Int32Array;
    /** Packed as startX, startY, endX, endY. */
    segments: Float32Array;
    /** Packed as clearanceWidth, clearanceHeight. */
    clearances: Float32Array;
}>;

export type GardenStructureBlockedTransitionKind =
    | 'wall'
    | 'window'
    | 'closed-door';

export type GardenStructureBlockedTransitionPlan = Readonly<{
    ids: readonly string[];
    edgeIds: readonly string[];
    partIds: readonly string[];
    kinds: readonly GardenStructureBlockedTransitionKind[];
    /** Packed as fromX, fromY, toX, toY. */
    adjacentCells: Int32Array;
    /** Packed as startX, startY, endX, endY. */
    segments: Float32Array;
}>;

export type GardenStructureCollisionBoxKind =
    | GardenStructureBlockedTransitionKind
    | 'prop';

/**
 * Bounds are packed as minX, minY, maxX, maxY, minHeight, maxHeight. Edge
 * boxes may merge adjacent compatible edge segments; prop boxes stay coarse
 * and structure-local.
 */
export type GardenStructureCollisionBoxes = Readonly<{
    ids: readonly string[];
    kinds: readonly GardenStructureCollisionBoxKind[];
    sourceIds: readonly (readonly string[])[];
    bounds: Float32Array;
}>;

export type GardenStructureCeilingProxies = Readonly<{
    ids: readonly string[];
    roofRegionIds: readonly string[];
    bounds: Float32Array;
}>;

export type GardenStructureSpatialBucket = Readonly<{
    id: string;
    key: string;
    x: number;
    y: number;
    walkableCellIndices: Uint32Array;
    floorIndices: Uint32Array;
    openPortalIndices: Uint32Array;
    blockedTransitionIndices: Uint32Array;
    wallBoxIndices: Uint32Array;
    propBoxIndices: Uint32Array;
    ceilingProxyIndices: Uint32Array;
}>;

export type GardenStructureBatchCategory =
    | 'opaque'
    | 'transparent'
    | 'roof'
    | 'props';

export type GardenStructureBatchGeometryKind =
    | 'floor-cell'
    | 'edge-segment'
    | 'roof-cell'
    | 'prop';

/**
 * A small render submission description, not a rendered part. Every instance
 * is columnar: transforms are packed as worldX, worldY, quarterTurns.
 */
export type GardenStructureBatchDescription = Readonly<{
    id: string;
    category: GardenStructureBatchCategory;
    geometryKind: GardenStructureBatchGeometryKind;
    geometryId: string;
    variantId?: string;
    materialId: string;
    transparency: GardenStructureMaterialTransparency;
    instanceIds: readonly string[];
    transformStride: 3;
    transforms: Float32Array;
}>;

export type GardenStructureBatchPlan = Readonly<{
    opaque: readonly GardenStructureBatchDescription[];
    transparent: readonly GardenStructureBatchDescription[];
    roof: readonly GardenStructureBatchDescription[];
    props: readonly GardenStructureBatchDescription[];
}>;

export type GardenStructureCompilerCounts = Readonly<{
    footprintCells: number;
    floorSurfaces: number;
    walkableCells: number;
    openPortals: number;
    blockedTransitions: number;
    wallCollisionBoxes: number;
    propCollisionBoxes: number;
    ceilingProxies: number;
    spatialBuckets: number;
    opaqueBatches: number;
    transparentBatches: number;
    roofBatches: number;
    propBatches: number;
    renderBatches: number;
    renderInstances: number;
    interactionIds: number;
}>;

export type GardenStructureRuntimeSafety = Readonly<{
    collisionMode: 'semantic' | 'blocked-footprint';
    issueSampleTruncated: boolean;
    issues: readonly GardenStructureKitMetadataIssue[];
}>;

export type GardenStructureSemanticPlan = Readonly<{
    id: string;
    cacheKey: string;
    structureId: string;
    revision: number;
    kitKey: string;
    kitVersion: string;
    /** Stable identity for the exact validated kit definition, when semantic. */
    kitDefinitionFingerprint: string | null;
    placement: Readonly<{
        anchorX: number;
        anchorY: number;
        rotation: GardenStructureRotation;
    }>;
    baseHeight: number;
    worldBounds: GardenStructureWorldBounds;
    footprint: GardenStructureFootprintPlan;
    floors: GardenStructureFloorPlan;
    walkable: GardenStructureWalkablePlan;
    openPortals: GardenStructureOpenPortalPlan;
    blockedTransitions: GardenStructureBlockedTransitionPlan;
    wallCollisionBoxes: GardenStructureCollisionBoxes;
    propCollisionBoxes: GardenStructureCollisionBoxes;
    ceilingProxies: GardenStructureCeilingProxies;
    spatialBuckets: readonly GardenStructureSpatialBucket[];
    spatialBucketIndexByKey: Readonly<Record<string, number>>;
    batches: GardenStructureBatchPlan;
    interactionIds: readonly string[];
    runtimeSafety: GardenStructureRuntimeSafety;
    counts: GardenStructureCompilerCounts;
}>;

export type GardenStructureCompilerBenchmarkResult = Readonly<{
    iterations: number;
    totalDurationMs: number;
    averageDurationMs: number;
    counts: GardenStructureCompilerCounts;
}>;
