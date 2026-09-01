export {
    compileGardenStructurePlan,
    containsGardenStructureWorldCell,
    containsGardenStructureWorldPoint,
    getGardenStructureCollisionBoxBounds,
    getGardenStructureCompilerCounts,
    getGardenStructureNearbySpatialBuckets,
    getGardenStructurePackedCell,
    getGardenStructurePlanCacheKey,
} from './compileGardenStructurePlan';
export {
    debugGardenStructureKitMetadata,
    gardenStructureKitMetadataRegistry,
    getGardenStructureKitMetadata,
} from './debugStructureKit';
export * from './editor';
export type {
    GardenStructureCollectionRendererProps,
    GardenStructureCollectionSelection,
} from './GardenStructureCollectionRenderer';
export { GardenStructureCollectionRenderer } from './GardenStructureCollectionRenderer';
export {
    createGardenStructureAvatarCollisionWorld,
    createGardenStructureCollectionAvatarCollisionWorld,
    getGardenStructureAvatarCollisionSurfaces,
} from './gardenStructureAvatarCollision';
export type {
    GardenStructureAvatarInteriorPresentation,
    GardenStructureAvatarWorldChangePose,
} from './gardenStructureAvatarInterior';
export {
    areGardenStructureAvatarInteriorPresentationsEqual,
    emptyGardenStructureAvatarInteriorPresentation,
    findContainingGardenStructure,
    findGardenStructureAvatarSafeRelocation,
    getGardenStructureAvatarInteriorPresentation,
    resolveGardenStructureAvatarWorldChangePose,
    resolveGardenStructureThirdPersonCameraPosition,
} from './gardenStructureAvatarInterior';
export type {
    GardenStructureCollectionBatchDescription,
    GardenStructureCollectionBatches,
    GardenStructureCollectionBuildOptions,
    GardenStructureCollectionBuildResult,
    GardenStructureCollectionCacheDisposalReason,
    GardenStructureCollectionCacheDispose,
    GardenStructureCollectionCacheOptions,
    GardenStructureCollectionCacheSnapshot,
    GardenStructureCollectionPlan,
    GardenStructureCollectionPlanEntry,
    GardenStructureCollectionSpatialBucket,
    GardenStructureCollectionSpatialEntry,
    GardenStructureCollectionVisibilityPredicate,
    GardenStructureCollectionWarning,
    GardenStructureFallbackBoxGeometry,
} from './gardenStructureCollectionPlan';
export {
    compileSavedGardenStructureCollection,
    createGardenStructureCollectionPlan,
    GardenStructureCollectionCache,
    gardenStructureCollectionCacheMaxEntryCount,
    gardenStructureCollectionCacheMaxEstimatedBytes,
    gardenStructureCollectionMaxStructureCount,
    gardenStructureCollectionTransformStride,
    getGardenStructureCollectionPlanEstimatedBytes,
    getNearbyGardenStructureCollectionBuckets,
    getVisibleGardenStructureIds,
    resolveGardenStructureCollectionSpatialEntry,
} from './gardenStructureCollectionPlan';
export { getGardenStructureDocumentFingerprint } from './gardenStructureDocumentFingerprint';
export type {
    GardenStructureKitMetadataIssue,
    GardenStructureKitMetadataIssueCode,
    GardenStructureKitMetadataValidation,
    GardenStructureKitMetadataValidationCacheSnapshot,
} from './gardenStructureKitMetadataValidation';
export {
    GardenStructureKitMetadataValidationCache,
    gardenStructureKitMetadataCollectionEntryLimit,
    gardenStructureKitMetadataValidationIssueLimit,
    hasFatalGardenStructureKitResolutionIssue,
    validateGardenStructureDocumentKitMetadata,
    validateGardenStructureKitMetadata,
} from './gardenStructureKitMetadataValidation';
export type {
    GardenStructureKitAnchor,
    GardenStructureKitAssetManifest,
    GardenStructureKitBounds,
    GardenStructureKitEdgeAssetPart,
    GardenStructureKitFloorAssetPart,
    GardenStructureKitManifestIssue,
    GardenStructureKitNodeBinding,
    GardenStructureKitPropAssetPart,
    GardenStructureKitRoofAssetPart,
    GardenStructureKitSemanticMaterial,
    GardenStructureKitVector3,
} from './gardenStructureKitV1Manifest';
export {
    gardenStructureKitV1AssetManifest,
    gardenStructureKitV1Metadata,
    getGardenStructureKitV1NodeNames,
    validateGardenStructureKitV1Manifest,
} from './gardenStructureKitV1Manifest';
export type {
    GardenStructurePlanCacheDisposalReason,
    GardenStructurePlanCacheDispose,
    GardenStructurePlanCacheOptions,
    GardenStructurePlanCacheSnapshot,
} from './gardenStructurePlanCache';
export {
    GardenStructurePlanCache,
    gardenStructurePlanCacheMaxEntryCount,
    gardenStructurePlanCacheMaxEstimatedBytes,
    getGardenStructurePlanCacheEntryEstimatedBytes,
    getGardenStructureSemanticPlanEstimatedBytes,
} from './gardenStructurePlanCache';
export type {
    GardenStructureRuntimeKitDefinition,
    GardenStructureRuntimeKitResolver,
    GardenStructureSavedRecordAdapterOptions,
    GardenStructureSavedRecordFailure,
    GardenStructureSavedRecordIssue,
    GardenStructureSavedRecordIssueCode,
    GardenStructureSavedRecordResult,
    GardenStructureSavedRecordSuccess,
    SerializedGardenStructureRecord,
} from './gardenStructureSavedRecord';
export {
    decodeSavedGardenStructureRecord,
    resolveGardenStructureRuntimeKit,
} from './gardenStructureSavedRecord';
export type {
    GardenStructureSceneBaseHeightInput,
    GardenStructureSceneBuildPreviewInput,
    GardenStructureSceneCacheOptions,
    GardenStructureSceneDiagnosticStatus,
    GardenStructureSceneDiagnostics,
    GardenStructureSceneResolveInput,
    GardenStructureSceneSnapshot,
    GardenStructureSceneStructureBaseHeightInput,
} from './gardenStructureScene';
export {
    createGardenStructureSceneBaseHeightResolver,
    createGardenStructureSceneBuildPreviewCompileInput,
    createGardenStructureSceneFixtureBuildPreviewCompileInput,
    GardenStructureSceneCache,
    resolveGardenStructureSceneStructureBaseHeight,
    useGardenStructureSceneSnapshot,
} from './gardenStructureScene';
export type {
    GardenStructureBatchCategory,
    GardenStructureBatchDescription,
    GardenStructureBatchGeometryKind,
    GardenStructureBatchPlan,
    GardenStructureBlockedTransitionKind,
    GardenStructureBlockedTransitionPlan,
    GardenStructureCeilingProxies,
    GardenStructureCollisionBoxes,
    GardenStructureCollisionBoxKind,
    GardenStructureCompileInput,
    GardenStructureCompilerBenchmarkResult,
    GardenStructureCompilerCounts,
    GardenStructureEdgePartMetadata,
    GardenStructureFloorPlan,
    GardenStructureFootprintPlan,
    GardenStructureHorizontalBounds,
    GardenStructureKitMetadata,
    GardenStructureMaterialMetadata,
    GardenStructureMaterialTransparency,
    GardenStructureOpenPortalPlan,
    GardenStructurePackedCells,
    GardenStructurePropPartMetadata,
    GardenStructureRoofStyleMetadata,
    GardenStructureRuntimeSafety,
    GardenStructureSemanticPlan,
    GardenStructureSpatialBucket,
    GardenStructureWalkablePlan,
    GardenStructureWorldBounds,
} from './structurePlanTypes';
