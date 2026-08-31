import type { ThreeEvent } from '@react-three/fiber';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import {
    BoxGeometry,
    Color,
    type InstancedMesh,
    MeshStandardMaterial,
    Object3D,
} from 'three';
import {
    GardenStructureKitV1AssetBoundary,
    GardenStructureKitV1LoadedInstances,
    type GardenStructureKitV1RuntimeBatch,
} from './GardenStructureKitV1AssetRenderer';
import {
    type GardenStructureCollectionBatchDescription,
    type GardenStructureCollectionPlan,
    type GardenStructureCollectionVisibilityPredicate,
    gardenStructureCollectionTransformStride,
    getVisibleGardenStructureIds,
} from './gardenStructureCollectionPlan';
import { isGardenStructureKitV1DefinitionCompatible } from './gardenStructureKitV1Compatibility';

export type GardenStructureCollectionSelection = Readonly<{
    instanceId: string;
    structureId: string;
}>;

export type GardenStructureCollectionRendererProps = Readonly<{
    castShadows?: boolean;
    isStructureVisible?: GardenStructureCollectionVisibilityPredicate;
    onRendererReady?: () => void;
    onSelect?: (selection: GardenStructureCollectionSelection) => void;
    plan: GardenStructureCollectionPlan;
    renderProps?: boolean;
    selectedInstanceId?: string | null;
    visibleStructureIds?: ReadonlySet<string>;
}>;

function materialColor(materialId: string) {
    if (materialId.includes('greenhouse')) {
        return '#9bd8c7';
    }
    if (materialId.includes('clay')) {
        return '#a74f32';
    }
    if (materialId.includes('plaster')) {
        return '#eee0c5';
    }
    if (materialId.includes('limestone') || materialId.includes('stone')) {
        return '#aaa69b';
    }
    if (materialId.includes('planter')) {
        return '#7e5a35';
    }
    if (materialId.includes('table') || materialId.includes('workbench')) {
        return '#7f4f2f';
    }
    return '#9a6542';
}

function intersectVisibleStructureIds(
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

function getVisibleInstanceIndices(
    batch: GardenStructureCollectionBatchDescription,
    visibleStructureIds: ReadonlySet<string> | undefined,
) {
    if (!visibleStructureIds) {
        return batch.instanceIds.map((_, index) => index);
    }
    return batch.structureIds.flatMap((structureId, index) =>
        visibleStructureIds.has(structureId) ? [index] : [],
    );
}

function GardenStructureCollectionFallbackBatchInstances({
    batch,
    castShadows,
    geometry,
    onSelect,
    selectedInstanceId,
    visibleStructureIds,
}: {
    batch: GardenStructureCollectionBatchDescription;
    castShadows: boolean;
    geometry: BoxGeometry;
    onSelect?: GardenStructureCollectionRendererProps['onSelect'];
    selectedInstanceId: string | null;
    visibleStructureIds?: ReadonlySet<string>;
}) {
    const meshRef = useRef<InstancedMesh>(null);
    const scratch = useMemo(() => new Object3D(), []);
    const baseColor = useMemo(
        () => new Color(materialColor(batch.materialId)),
        [batch.materialId],
    );
    const selectedColor = useMemo(() => new Color('#f59e0b'), []);
    const transparent = batch.transparency === 'transparent';
    const material = useMemo(
        () =>
            new MeshStandardMaterial({
                // The semantic fallback uses hashed transparency so hundreds
                // of greenhouse instances do not require camera-depth sorting.
                alphaHash: transparent,
                color: '#ffffff',
                depthWrite: true,
                opacity: transparent ? 0.38 : 1,
                roughness: transparent ? 0.18 : 0.82,
                metalness: transparent ? 0.05 : 0,
                transparent: false,
            }),
        [transparent],
    );
    const visibleInstanceIndices = useMemo(
        () => getVisibleInstanceIndices(batch, visibleStructureIds),
        [batch, visibleStructureIds],
    );

    useEffect(() => () => material.dispose(), [material]);
    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }
        mesh.count = visibleInstanceIndices.length;
        mesh.visible = visibleInstanceIndices.length > 0;
        if (!mesh.visible) {
            return;
        }
        const fallback = batch.fallbackGeometry;
        for (const [
            visibleIndex,
            sourceIndex,
        ] of visibleInstanceIndices.entries()) {
            const offset =
                sourceIndex * gardenStructureCollectionTransformStride;
            const x = batch.transforms[offset];
            const z = batch.transforms[offset + 1];
            const rotation = batch.transforms[offset + 2];
            const baseHeight = batch.transforms[offset + 3];
            if (
                x === undefined ||
                z === undefined ||
                rotation === undefined ||
                baseHeight === undefined
            ) {
                continue;
            }
            scratch.position.set(
                x,
                baseHeight + fallback.centerHeightOffset,
                z,
            );
            scratch.rotation.set(0, rotation * (Math.PI / 2), 0);
            scratch.scale.set(fallback.width, fallback.height, fallback.depth);
            scratch.updateMatrix();
            mesh.setMatrixAt(visibleIndex, scratch.matrix);
            mesh.setColorAt(
                visibleIndex,
                batch.instanceIds[sourceIndex] === selectedInstanceId
                    ? selectedColor
                    : baseColor,
            );
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [
        baseColor,
        batch,
        scratch,
        selectedColor,
        selectedInstanceId,
        visibleInstanceIndices,
    ]);

    const handleClick = useCallback(
        (event: ThreeEvent<MouseEvent>) => {
            if (!onSelect || event.instanceId === undefined) {
                return;
            }
            const sourceIndex = visibleInstanceIndices[event.instanceId];
            if (sourceIndex === undefined) {
                return;
            }
            const instanceId = batch.instanceIds[sourceIndex];
            const structureId = batch.structureIds[sourceIndex];
            if (!instanceId || !structureId) {
                return;
            }
            event.stopPropagation();
            onSelect({ instanceId, structureId });
        },
        [
            batch.instanceIds,
            batch.structureIds,
            onSelect,
            visibleInstanceIndices,
        ],
    );

    return (
        // A DOM inspector/action list must provide the equivalent selection.
        // biome-ignore lint/a11y/noStaticElementInteractions: R3F instance picking has a DOM alternative.
        <instancedMesh
            args={[geometry, material, batch.instanceIds.length]}
            castShadow={castShadows && !transparent}
            frustumCulled
            name={`GardenStructureCollectionBatch:${batch.id}`}
            onClick={onSelect ? handleClick : undefined}
            receiveShadow
            ref={meshRef}
            renderOrder={0}
            visible={visibleInstanceIndices.length > 0}
            userData={{
                kitKey: batch.kitKey,
                kitVersion: batch.kitVersion,
                semanticFallback: true,
            }}
        />
    );
}

function GardenStructureCollectionFallbackRenderer({
    batches,
    castShadows,
    onSelect,
    selectedInstanceId,
    visibleStructureIds,
}: Readonly<{
    batches: readonly GardenStructureCollectionBatchDescription[];
    castShadows: boolean;
    onSelect?: GardenStructureCollectionRendererProps['onSelect'];
    selectedInstanceId: string | null;
    visibleStructureIds?: ReadonlySet<string>;
}>) {
    const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <group
            name="GardenStructures:CollectionSemanticFallback"
            userData={{ semanticFallback: true }}
        >
            {batches.map((batch) => (
                <GardenStructureCollectionFallbackBatchInstances
                    batch={batch}
                    castShadows={castShadows}
                    geometry={geometry}
                    key={batch.id}
                    onSelect={onSelect}
                    selectedInstanceId={selectedInstanceId}
                    visibleStructureIds={visibleStructureIds}
                />
            ))}
        </group>
    );
}

/**
 * Batched semantic fallback renderer for an existing R3F scene. It deliberately
 * creates no Canvas, per-part React node, or frame callback. Camera subscribers
 * can update the optional whole-structure visibility set without changing the
 * saved semantic plan.
 */
export function GardenStructureCollectionRenderer({
    castShadows = true,
    isStructureVisible,
    onRendererReady,
    onSelect,
    plan,
    renderProps = true,
    selectedInstanceId = null,
    visibleStructureIds,
}: GardenStructureCollectionRendererProps) {
    const predicateVisibleIds = useMemo(
        () =>
            isStructureVisible
                ? getVisibleGardenStructureIds(plan, isStructureVisible)
                : undefined,
        [isStructureVisible, plan],
    );
    const effectiveVisibleIds = useMemo(
        () =>
            intersectVisibleStructureIds(
                visibleStructureIds,
                predicateVisibleIds,
            ),
        [predicateVisibleIds, visibleStructureIds],
    );
    const batches = useMemo(
        () => [
            ...plan.batches.opaque,
            ...plan.batches.transparent,
            ...plan.batches.roof,
            ...(renderProps ? plan.batches.props : []),
        ],
        [plan.batches, renderProps],
    );
    const batchById = useMemo(
        () => new Map(batches.map((batch) => [batch.id, batch])),
        [batches],
    );
    const assetBatches = useMemo(
        () => batches.filter(isGardenStructureKitV1DefinitionCompatible),
        [batches],
    );
    const assetBatchIds = useMemo(
        () => new Set(assetBatches.map(({ id }) => id)),
        [assetBatches],
    );
    const semanticFallbackBatches = useMemo(
        () =>
            batches.filter(
                ({ rendersSemanticFallback }) => rendersSemanticFallback,
            ),
        [batches],
    );
    const incompatibleFallbackBatches = useMemo(
        () =>
            semanticFallbackBatches.filter(({ id }) => !assetBatchIds.has(id)),
        [assetBatchIds, semanticFallbackBatches],
    );
    const assetFallbackBatches = useMemo(
        () => semanticFallbackBatches.filter(({ id }) => assetBatchIds.has(id)),
        [assetBatchIds, semanticFallbackBatches],
    );
    const getVisibleIndices = useCallback(
        (runtimeBatch: GardenStructureKitV1RuntimeBatch) => {
            const batch = batchById.get(runtimeBatch.id);
            return batch
                ? getVisibleInstanceIndices(batch, effectiveVisibleIds)
                : [];
        },
        [batchById, effectiveVisibleIds],
    );
    const selectInstance = useCallback(
        (
            runtimeBatch: GardenStructureKitV1RuntimeBatch,
            sourceIndex: number,
        ) => {
            const batch = batchById.get(runtimeBatch.id);
            const instanceId = batch?.instanceIds[sourceIndex];
            const structureId = batch?.structureIds[sourceIndex];
            if (!onSelect || !instanceId || !structureId) {
                return;
            }
            onSelect({ instanceId, structureId });
        },
        [batchById, onSelect],
    );
    const renderFallback = useCallback(
        (batchIds: readonly string[]) => {
            const unresolvedIds = new Set(batchIds);
            return (
                <GardenStructureCollectionFallbackRenderer
                    batches={assetFallbackBatches.filter(({ id }) =>
                        unresolvedIds.has(id),
                    )}
                    castShadows={castShadows}
                    onSelect={onSelect}
                    selectedInstanceId={selectedInstanceId}
                    visibleStructureIds={effectiveVisibleIds}
                />
            );
        },
        [
            castShadows,
            effectiveVisibleIds,
            onSelect,
            selectedInstanceId,
            assetFallbackBatches,
        ],
    );
    const fallback = (
        <GardenStructureCollectionFallbackRenderer
            batches={assetFallbackBatches}
            castShadows={castShadows}
            onSelect={onSelect}
            selectedInstanceId={selectedInstanceId}
            visibleStructureIds={effectiveVisibleIds}
        />
    );

    const fallbackOnlyPlanCacheKey =
        assetBatches.length === 0 ? plan.cacheKey : null;
    useEffect(() => {
        if (fallbackOnlyPlanCacheKey !== null) {
            onRendererReady?.();
        }
    }, [fallbackOnlyPlanCacheKey, onRendererReady]);

    return (
        <group
            name="GardenStructures:Collection"
            userData={{
                assetName: 'GardenStructureKitV1',
                collectionCacheKey: plan.cacheKey,
                structureCount: plan.structures.length,
            }}
        >
            {incompatibleFallbackBatches.length > 0 ? (
                <GardenStructureCollectionFallbackRenderer
                    batches={incompatibleFallbackBatches}
                    castShadows={castShadows}
                    onSelect={onSelect}
                    selectedInstanceId={selectedInstanceId}
                    visibleStructureIds={effectiveVisibleIds}
                />
            ) : null}
            {assetBatches.length > 0 ? (
                <GardenStructureKitV1AssetBoundary
                    fallback={fallback}
                    onErrorFallbackReady={onRendererReady}
                >
                    <GardenStructureKitV1LoadedInstances
                        batches={assetBatches}
                        castShadows={castShadows}
                        getVisibleInstanceIndices={getVisibleIndices}
                        namePrefix="GardenStructureCollectionKitV1Batch"
                        onInstancesReady={onRendererReady}
                        onSelectInstance={onSelect ? selectInstance : undefined}
                        renderFallback={renderFallback}
                        selectedInstanceId={selectedInstanceId}
                    />
                </GardenStructureKitV1AssetBoundary>
            ) : null}
        </group>
    );
}
