'use client';

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
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import { useGameState } from '../useGameState';
import { debugGardenStructureKitMetadata } from './debugStructureKit';
import {
    GardenStructureKitV1AssetBoundary,
    GardenStructureKitV1LoadedInstances,
    type GardenStructureKitV1RuntimeBatch,
    isGardenStructureKitV1SemanticFallbackBatch,
} from './GardenStructureKitV1AssetRenderer';
import { getGardenStructurePlanBaselineVisiblePropInstanceIds } from './gardenStructureSceneVisibility';
import {
    getGardenStructureVerticalSliceBatches,
    getGardenStructureVerticalSliceVisibleInstanceIndices,
} from './gardenStructureVerticalSliceBatches';
import type {
    GardenStructureBatchDescription,
    GardenStructureSemanticPlan,
} from './structurePlanTypes';

const coordinateStride = 2;
const transformStride = 3;

type GetVisibleInstanceIndices = (
    batch: GardenStructureKitV1RuntimeBatch,
) => readonly number[];

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

function getBatchDimensions(
    batch: GardenStructureBatchDescription,
    baseHeight: number,
) {
    switch (batch.geometryKind) {
        case 'floor-cell':
            return {
                centerHeight:
                    baseHeight -
                    debugGardenStructureKitMetadata.floorThickness / 2,
                depth: 0.96,
                height: debugGardenStructureKitMetadata.floorThickness,
                width: 0.96,
            };
        case 'edge-segment': {
            const metadata =
                debugGardenStructureKitMetadata.edgeParts[batch.geometryId];
            const height = metadata?.collisionHeight ?? 2.4;
            return {
                centerHeight: baseHeight + height / 2,
                depth: metadata?.collisionThickness ?? 0.12,
                height,
                width: 1,
            };
        }
        case 'roof-cell': {
            const metadata =
                debugGardenStructureKitMetadata.roofStyles[batch.geometryId];
            return {
                centerHeight:
                    baseHeight + (metadata?.ceilingHeight ?? 2.4) + 0.08,
                depth: 1.04,
                height: 0.16,
                width: 1.04,
            };
        }
        case 'prop': {
            const metadata =
                debugGardenStructureKitMetadata.propParts[batch.geometryId];
            const height = metadata?.collisionHeight ?? 0.7;
            return {
                centerHeight: baseHeight + height / 2,
                depth: metadata?.collisionDepth ?? 0.6,
                height,
                width: metadata?.collisionWidth ?? 0.6,
            };
        }
    }
}

function GardenStructureFallbackBatchInstances({
    baseHeight,
    batch,
    geometry,
    getVisibleInstanceIndices,
    onSelect,
    selectedPartId,
}: {
    baseHeight: number;
    batch: GardenStructureBatchDescription;
    geometry: BoxGeometry;
    getVisibleInstanceIndices: GetVisibleInstanceIndices;
    onSelect?: (id: string) => void;
    selectedPartId: string | null;
}) {
    const meshRef = useRef<InstancedMesh>(null);
    const scratch = useMemo(() => new Object3D(), []);
    const baseColor = useMemo(
        () => new Color(materialColor(batch.materialId)),
        [batch.materialId],
    );
    const selectedColor = useMemo(() => new Color('#f59e0b'), []);
    const visibleInstanceIndices = useMemo(
        () => getVisibleInstanceIndices(batch),
        [batch, getVisibleInstanceIndices],
    );
    const transparent = batch.transparency === 'transparent';
    const material = useMemo(
        () =>
            new MeshStandardMaterial({
                color: '#ffffff',
                depthWrite: !transparent,
                opacity: transparent ? 0.38 : 1,
                roughness: transparent ? 0.18 : 0.82,
                metalness: transparent ? 0.05 : 0,
                transparent,
            }),
        [transparent],
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
        const dimensions = getBatchDimensions(batch, baseHeight);
        for (const [
            visibleIndex,
            sourceIndex,
        ] of visibleInstanceIndices.entries()) {
            const offset = sourceIndex * transformStride;
            const x = batch.transforms[offset];
            const z = batch.transforms[offset + 1];
            const rotation = batch.transforms[offset + 2];
            if (x === undefined || z === undefined || rotation === undefined) {
                continue;
            }
            scratch.position.set(x, dimensions.centerHeight, z);
            scratch.rotation.set(0, rotation * (Math.PI / 2), 0);
            scratch.scale.set(
                dimensions.width,
                dimensions.height,
                dimensions.depth,
            );
            scratch.updateMatrix();
            mesh.setMatrixAt(visibleIndex, scratch.matrix);
            mesh.setColorAt(
                visibleIndex,
                batch.instanceIds[sourceIndex] === selectedPartId
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
        baseHeight,
        batch,
        scratch,
        selectedColor,
        selectedPartId,
        visibleInstanceIndices,
    ]);

    const handleClick = useCallback(
        (event: ThreeEvent<MouseEvent>) => {
            if (!onSelect || event.instanceId === undefined) {
                return;
            }
            const sourceIndex = visibleInstanceIndices[event.instanceId];
            const id =
                sourceIndex === undefined
                    ? undefined
                    : batch.instanceIds[sourceIndex];
            if (!id) {
                return;
            }
            event.stopPropagation();
            onSelect(id);
        },
        [batch.instanceIds, onSelect, visibleInstanceIndices],
    );

    return (
        // Biome treats R3F scene objects as DOM nodes. Keyboard users select
        // the same IDs through the adjacent DOM HUD/inspector in build mode.
        // biome-ignore lint/a11y/noStaticElementInteractions: R3F instance picking has a DOM alternative.
        <instancedMesh
            args={[geometry, material, batch.instanceIds.length]}
            castShadow={!transparent}
            frustumCulled
            name={`GardenStructureBatch:${batch.id}`}
            onClick={onSelect ? handleClick : undefined}
            receiveShadow
            ref={meshRef}
            renderOrder={transparent ? 6 : 0}
        />
    );
}

function GardenStructureVerticalSliceFallbackRenderer({
    baseHeight,
    batches,
    geometry,
    getVisibleInstanceIndices,
    onSelect,
    selectedPartId,
}: Readonly<{
    baseHeight: number;
    batches: readonly GardenStructureBatchDescription[];
    geometry: BoxGeometry;
    getVisibleInstanceIndices: GetVisibleInstanceIndices;
    onSelect?: (id: string) => void;
    selectedPartId: string | null;
}>) {
    return (
        <group
            name="GardenStructures:VerticalSliceSemanticFallback"
            userData={{ semanticFallback: true }}
        >
            {batches.map((batch) => (
                <GardenStructureFallbackBatchInstances
                    baseHeight={baseHeight}
                    batch={batch}
                    geometry={geometry}
                    getVisibleInstanceIndices={getVisibleInstanceIndices}
                    key={batch.id}
                    onSelect={onSelect}
                    selectedPartId={selectedPartId}
                />
            ))}
        </group>
    );
}

function GardenStructureFootprintPreview({
    geometry,
    plan,
}: {
    geometry: BoxGeometry;
    plan: GardenStructureSemanticPlan;
}) {
    const meshRef = useRef<InstancedMesh>(null);
    const scratch = useMemo(() => new Object3D(), []);
    const interiorColor = useMemo(() => new Color('#fbbf24'), []);
    const outdoorColor = useMemo(() => new Color('#34d399'), []);
    const material = useMemo(
        () =>
            new MeshStandardMaterial({
                color: '#ffffff',
                depthWrite: false,
                opacity: 0.24,
                roughness: 1,
                transparent: true,
            }),
        [],
    );

    useEffect(() => () => material.dispose(), [material]);
    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }
        for (let index = 0; index < plan.footprint.ids.length; index += 1) {
            const offset = index * coordinateStride;
            const x = plan.footprint.coordinates[offset];
            const z = plan.footprint.coordinates[offset + 1];
            if (x === undefined || z === undefined) {
                continue;
            }
            scratch.position.set(x, plan.baseHeight + 0.015, z);
            scratch.rotation.set(0, 0, 0);
            scratch.scale.set(0.9, 0.025, 0.9);
            scratch.updateMatrix();
            mesh.setMatrixAt(index, scratch.matrix);
            mesh.setColorAt(
                index,
                plan.footprint.spaceKinds[index] === 1
                    ? outdoorColor
                    : interiorColor,
            );
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [interiorColor, outdoorColor, plan, scratch]);

    return (
        <instancedMesh
            args={[geometry, material, plan.footprint.ids.length]}
            name="GardenStructureFootprintPreview"
            receiveShadow
            ref={meshRef}
            renderOrder={7}
        />
    );
}

export type GardenStructureVerticalSliceProps = Readonly<{
    plan: GardenStructureSemanticPlan;
    profileMetricsEnabled?: boolean;
}>;

export function GardenStructureVerticalSlice({
    plan,
    profileMetricsEnabled = false,
}: GardenStructureVerticalSliceProps) {
    const session = useGameState((state) => state.structureBuildSession);
    const setSession = useGameState((state) => state.setStructureBuildSession);
    const renderProps = session?.roofCutaway ?? false;
    const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
    useEffect(() => () => geometry.dispose(), [geometry]);
    const selectPart = useCallback(
        (selectedPartId: string) => {
            if (!session) {
                return;
            }
            setSession({ ...session, selectedPartId });
        },
        [session, setSession],
    );
    const baselineVisiblePropInstanceIds = useMemo(
        () => getGardenStructurePlanBaselineVisiblePropInstanceIds(plan),
        [plan],
    );
    const batches = useMemo(
        () =>
            getGardenStructureVerticalSliceBatches({
                baselineVisiblePropInstanceIds,
                plan,
                renderProps,
                roofCutaway: renderProps,
            }),
        [baselineVisiblePropInstanceIds, plan, renderProps],
    );
    const batchById = useMemo(
        () => new Map(batches.map((batch) => [batch.id, batch])),
        [batches],
    );
    const semanticFallbackBatches = useMemo(
        () => batches.filter(isGardenStructureKitV1SemanticFallbackBatch),
        [batches],
    );
    const getVisibleIndices = useCallback(
        (runtimeBatch: GardenStructureKitV1RuntimeBatch) => {
            const batch = batchById.get(runtimeBatch.id);
            return batch
                ? getGardenStructureVerticalSliceVisibleInstanceIndices({
                      baselineVisiblePropInstanceIds,
                      batch,
                      renderProps,
                  })
                : [];
        },
        [baselineVisiblePropInstanceIds, batchById, renderProps],
    );
    const selectInstance = useCallback(
        (
            runtimeBatch: GardenStructureKitV1RuntimeBatch,
            sourceIndex: number,
        ) => {
            const selectedPartId = batchById.get(runtimeBatch.id)?.instanceIds[
                sourceIndex
            ];
            if (selectedPartId) {
                selectPart(selectedPartId);
            }
        },
        [batchById, selectPart],
    );
    const renderFallback = useCallback(
        (batchIds: readonly string[]) => {
            const unresolvedIds = new Set(batchIds);
            return (
                <GardenStructureVerticalSliceFallbackRenderer
                    baseHeight={plan.baseHeight}
                    batches={semanticFallbackBatches.filter(({ id }) =>
                        unresolvedIds.has(id),
                    )}
                    geometry={geometry}
                    getVisibleInstanceIndices={getVisibleIndices}
                    onSelect={session ? selectPart : undefined}
                    selectedPartId={session?.selectedPartId ?? null}
                />
            );
        },
        [
            geometry,
            getVisibleIndices,
            plan.baseHeight,
            selectPart,
            semanticFallbackBatches,
            session,
        ],
    );
    const fallback = (
        <GardenStructureVerticalSliceFallbackRenderer
            baseHeight={plan.baseHeight}
            batches={semanticFallbackBatches}
            geometry={geometry}
            getVisibleInstanceIndices={getVisibleIndices}
            onSelect={session ? selectPart : undefined}
            selectedPartId={session?.selectedPartId ?? null}
        />
    );
    const profileCounts = useMemo(() => {
        if (!profileMetricsEnabled) {
            return undefined;
        }
        const renderedPropCount = batches
            .filter((batch) => batch.category === 'props')
            .reduce(
                (total, batch) => total + getVisibleIndices(batch).length,
                0,
            );
        const totalPropCount = plan.batches.props.reduce(
            (total, batch) => total + batch.instanceIds.length,
            0,
        );
        const transparentSurfaceCount = batches
            .filter((batch) => batch.transparency === 'transparent')
            .reduce(
                (total, batch) => total + getVisibleIndices(batch).length,
                0,
            );
        return {
            renderedPropCount,
            totalPropCount,
            transparentSurfaceCount,
        };
    }, [batches, getVisibleIndices, plan.batches.props, profileMetricsEnabled]);
    const previewInstanceCount = session ? plan.footprint.ids.length : 0;
    const profileMetrics = useMemo(
        () =>
            profileMetricsEnabled
                ? {
                      fallbackGeometry: geometry,
                      previewInstanceCount,
                  }
                : undefined,
        [geometry, previewInstanceCount, profileMetricsEnabled],
    );

    useEffect(() => {
        if (!profileMetricsEnabled || !profileCounts) {
            return;
        }
        updateGameProfileMetadata({
            gardenStructureBlockedTransitionCount:
                plan.counts.blockedTransitions,
            gardenStructureCollisionBucketCount: plan.counts.spatialBuckets,
            gardenStructureCollisionBoxCount:
                plan.counts.wallCollisionBoxes + plan.counts.propCollisionBoxes,
            gardenStructureExteriorSuppressedPropCount:
                profileCounts.totalPropCount - profileCounts.renderedPropCount,
            gardenStructureFootprintCellCount: plan.counts.footprintCells,
            gardenStructureOpenPortalCount: plan.counts.openPortals,
            gardenStructureTransparentSurfaceCount:
                profileCounts.transparentSurfaceCount,
            gardenStructureVisibleInteriorSurfaceCount:
                plan.counts.floorSurfaces + profileCounts.renderedPropCount,
            gardenStructureVisiblePropCount: profileCounts.renderedPropCount,
            gardenStructureWalkableCellCount: plan.counts.walkableCells,
        });
        return () =>
            updateGameProfileMetadata({
                gardenStructureBlockedTransitionCount: 0,
                gardenStructureCollisionBucketCount: 0,
                gardenStructureCollisionBoxCount: 0,
                gardenStructureExteriorSuppressedPropCount: 0,
                gardenStructureFootprintCellCount: 0,
                gardenStructureOpenPortalCount: 0,
                gardenStructureTransparentSurfaceCount: 0,
                gardenStructureVisibleInteriorSurfaceCount: 0,
                gardenStructureVisiblePropCount: 0,
                gardenStructureWalkableCellCount: 0,
            });
    }, [plan.counts, profileCounts, profileMetricsEnabled]);

    return (
        <group
            name="GardenStructures:VerticalSlice"
            userData={{
                assetName: 'GardenStructureKitV1',
                compilerCacheKey: plan.cacheKey,
                fixtureOnly: session?.persistence === 'fixture',
            }}
        >
            {session ? (
                <GardenStructureFootprintPreview
                    geometry={geometry}
                    plan={plan}
                />
            ) : null}
            <GardenStructureKitV1AssetBoundary fallback={fallback}>
                <GardenStructureKitV1LoadedInstances
                    baseHeight={plan.baseHeight}
                    batches={batches}
                    castShadows
                    getVisibleInstanceIndices={getVisibleIndices}
                    namePrefix="GardenStructureVerticalSliceKitV1Batch"
                    onSelectInstance={session ? selectInstance : undefined}
                    profileMetrics={profileMetrics}
                    renderFallback={renderFallback}
                    selectedInstanceId={session?.selectedPartId ?? null}
                />
            </GardenStructureKitV1AssetBoundary>
        </group>
    );
}
