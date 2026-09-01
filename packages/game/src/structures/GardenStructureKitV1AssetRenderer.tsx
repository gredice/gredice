'use client';

import type { ThreeEvent } from '@react-three/fiber';
import {
    Component,
    type ReactNode,
    Suspense,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import {
    type BufferGeometry,
    Color,
    type InstancedMesh,
    Matrix4,
    Object3D,
} from 'three';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import { useGameState } from '../useGameState';
import { resolveGameAssetModelUrl, useGameGLTF } from '../utils/useGameGLTF';
import {
    type GardenStructureKitV1AssetResolution,
    type GardenStructureKitV1ResolvedPrimitive,
    resolveGardenStructureKitV1Asset,
    resolveGardenStructureKitV1BatchGeometry,
} from './gardenStructureKitV1AssetResolver';
import { gardenStructureKitV1Metadata } from './gardenStructureKitV1Manifest';
import { measureGardenStructureKitV1ProfileMetrics } from './gardenStructureKitV1ProfileMetrics';
import type { GardenStructureBatchGeometryKind } from './structurePlanTypes';

export type GardenStructureKitV1RuntimeBatch = Readonly<{
    geometryId: string;
    geometryKind: GardenStructureBatchGeometryKind;
    id: string;
    instanceIds: readonly string[];
    materialId: string;
    transforms: Float32Array;
    transformStride: 3 | 4;
}>;

export function isGardenStructureKitV1SemanticFallbackBatch(
    batch: Pick<
        GardenStructureKitV1RuntimeBatch,
        'geometryId' | 'geometryKind'
    >,
) {
    return !(
        batch.geometryKind === 'edge-segment' &&
        gardenStructureKitV1Metadata.edgeParts[batch.geometryId]?.passage ===
            'open-portal'
    );
}

type GardenStructureKitV1AssetBoundaryProps = Readonly<{
    children: ReactNode;
    fallback: ReactNode;
    onErrorFallbackReady?: () => void;
}>;

type GardenStructureKitV1AssetBoundaryState = Readonly<{
    failed: boolean;
}>;

/** Keeps loader/parser failures local to structures while preserving geometry fallback. */
export class GardenStructureKitV1AssetErrorBoundary extends Component<
    GardenStructureKitV1AssetBoundaryProps,
    GardenStructureKitV1AssetBoundaryState
> {
    state: GardenStructureKitV1AssetBoundaryState = { failed: false };

    static getDerivedStateFromError(): GardenStructureKitV1AssetBoundaryState {
        return { failed: true };
    }

    componentDidCatch() {
        this.props.onErrorFallbackReady?.();
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

export function GardenStructureKitV1AssetBoundary({
    children,
    fallback,
    onErrorFallbackReady,
}: GardenStructureKitV1AssetBoundaryProps) {
    return (
        <GardenStructureKitV1AssetErrorBoundary
            fallback={fallback}
            onErrorFallbackReady={onErrorFallbackReady}
        >
            <Suspense fallback={fallback}>{children}</Suspense>
        </GardenStructureKitV1AssetErrorBoundary>
    );
}

type ResolvedDraw = Readonly<{
    batch: GardenStructureKitV1RuntimeBatch;
    id: string;
    primitive: GardenStructureKitV1ResolvedPrimitive;
}>;

type GardenStructureKitV1ResolvedProfileMetrics = Readonly<{
    assetUrl: string;
    fallbackGeometry: BufferGeometry;
    previewInstanceCount: number;
}>;

function resolveDraws(
    batches: readonly GardenStructureKitV1RuntimeBatch[],
    resolution: GardenStructureKitV1AssetResolution,
) {
    const opaque: ResolvedDraw[] = [];
    const transparent: ResolvedDraw[] = [];
    const unresolved: GardenStructureKitV1RuntimeBatch[] = [];

    for (const batch of batches) {
        const geometry = resolveGardenStructureKitV1BatchGeometry(
            resolution,
            batch,
        );
        if (!geometry || geometry.status === 'missing') {
            unresolved.push(batch);
            continue;
        }
        for (const [
            primitiveIndex,
            primitive,
        ] of geometry.primitives.entries()) {
            const draw = Object.freeze({
                batch,
                id: `${batch.id}:${primitive.nodeName}:${primitiveIndex.toString()}`,
                primitive,
            });
            (primitive.transparency === 'transparent'
                ? transparent
                : opaque
            ).push(draw);
        }
    }

    return Object.freeze({
        opaque: Object.freeze(opaque),
        transparent: Object.freeze(transparent),
        unresolved: Object.freeze(unresolved),
    });
}

function allInstanceIndices(batch: GardenStructureKitV1RuntimeBatch) {
    return batch.instanceIds.map((_, index) => index);
}

/**
 * Production floor meshes are authored from their lower face while the
 * semantic transform marks the walkable top surface. Keep the asset below
 * that surface so it matches the fallback geometry and collision volume.
 */
export function getGardenStructureKitV1AssetInstanceHeight(
    geometryKind: GardenStructureBatchGeometryKind,
    baseHeight: number,
) {
    return geometryKind === 'floor-cell'
        ? baseHeight - gardenStructureKitV1Metadata.floorThickness
        : baseHeight;
}

function GardenStructureKitV1PrimitiveInstances({
    baseHeight,
    castShadows,
    draw,
    getVisibleInstanceIndices,
    namePrefix,
    onSelectInstance,
    selectedInstanceId,
}: Readonly<{
    baseHeight?: number;
    castShadows: boolean;
    draw: ResolvedDraw;
    getVisibleInstanceIndices?: (
        batch: GardenStructureKitV1RuntimeBatch,
    ) => readonly number[];
    namePrefix: string;
    onSelectInstance?: (
        batch: GardenStructureKitV1RuntimeBatch,
        sourceIndex: number,
    ) => void;
    selectedInstanceId: string | null;
}>) {
    const { batch, primitive } = draw;
    const meshRef = useRef<InstancedMesh>(null);
    const scratch = useMemo(() => new Object3D(), []);
    const instanceMatrix = useMemo(() => new Matrix4(), []);
    const baseColor = useMemo(() => new Color('#ffffff'), []);
    const selectedColor = useMemo(() => new Color('#f59e0b'), []);
    const visibleInstanceIndices = useMemo(
        () => getVisibleInstanceIndices?.(batch) ?? allInstanceIndices(batch),
        [batch, getVisibleInstanceIndices],
    );

    useEffect(() => {
        const mesh = meshRef.current;
        return () => mesh?.dispose();
    }, []);

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

        for (const [
            visibleIndex,
            sourceIndex,
        ] of visibleInstanceIndices.entries()) {
            const offset = sourceIndex * batch.transformStride;
            const x = batch.transforms[offset];
            const z = batch.transforms[offset + 1];
            const rotation = batch.transforms[offset + 2];
            const instanceBaseHeight =
                batch.transformStride === 4
                    ? batch.transforms[offset + 3]
                    : baseHeight;
            if (
                x === undefined ||
                z === undefined ||
                rotation === undefined ||
                instanceBaseHeight === undefined
            ) {
                continue;
            }
            scratch.position.set(
                x,
                getGardenStructureKitV1AssetInstanceHeight(
                    batch.geometryKind,
                    instanceBaseHeight,
                ),
                z,
            );
            scratch.rotation.set(0, rotation * (Math.PI / 2), 0);
            scratch.scale.set(1, 1, 1);
            scratch.updateMatrix();
            instanceMatrix.multiplyMatrices(
                scratch.matrix,
                primitive.sourceMatrix,
            );
            mesh.setMatrixAt(visibleIndex, instanceMatrix);
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
        baseHeight,
        batch,
        instanceMatrix,
        primitive.sourceMatrix,
        scratch,
        selectedColor,
        selectedInstanceId,
        visibleInstanceIndices,
    ]);

    const handleClick = useCallback(
        (event: ThreeEvent<MouseEvent>) => {
            if (!onSelectInstance || event.instanceId === undefined) {
                return;
            }
            const sourceIndex = visibleInstanceIndices[event.instanceId];
            if (sourceIndex === undefined) {
                return;
            }
            event.stopPropagation();
            onSelectInstance(batch, sourceIndex);
        },
        [batch, onSelectInstance, visibleInstanceIndices],
    );

    const transparent = primitive.transparency === 'transparent';
    return (
        // The adjacent DOM inspector/HUD provides equivalent keyboard selection.
        // biome-ignore lint/a11y/noStaticElementInteractions: R3F instance picking has a DOM alternative.
        <instancedMesh
            args={[
                primitive.geometry,
                primitive.material,
                batch.instanceIds.length,
            ]}
            castShadow={castShadows && !transparent}
            dispose={null}
            frustumCulled
            name={`${namePrefix}:${primitive.nodeName}`}
            onClick={onSelectInstance ? handleClick : undefined}
            receiveShadow
            ref={meshRef}
            renderOrder={transparent ? 6 : 0}
            userData={{
                assetName: 'GardenStructureKitV1',
                geometryId: batch.geometryId,
                semanticFallback: false,
                sourceNodeName: primitive.sourceNodeName,
                sourcePrimitiveNodeName: primitive.nodeName,
                transparency: primitive.transparency,
            }}
            visible={visibleInstanceIndices.length > 0}
        />
    );
}

function GardenStructureKitV1ResolvedInstances({
    baseHeight,
    batches,
    castShadows,
    getVisibleInstanceIndices,
    namePrefix,
    onSelectInstance,
    profileMetrics,
    renderFallback,
    resolution,
    selectedInstanceId,
}: Readonly<{
    baseHeight?: number;
    batches: readonly GardenStructureKitV1RuntimeBatch[];
    castShadows: boolean;
    getVisibleInstanceIndices?: (
        batch: GardenStructureKitV1RuntimeBatch,
    ) => readonly number[];
    namePrefix: string;
    onSelectInstance?: (
        batch: GardenStructureKitV1RuntimeBatch,
        sourceIndex: number,
    ) => void;
    profileMetrics?: GardenStructureKitV1ResolvedProfileMetrics;
    renderFallback: (batchIds: readonly string[]) => ReactNode;
    resolution: GardenStructureKitV1AssetResolution;
    selectedInstanceId: string | null;
}>) {
    const draws = useMemo(
        () => resolveDraws(batches, resolution),
        [batches, resolution],
    );
    const measuredProfile = useMemo(
        () =>
            profileMetrics
                ? measureGardenStructureKitV1ProfileMetrics({
                      batches,
                      fallbackGeometry: profileMetrics.fallbackGeometry,
                      getVisibleInstanceCount: (batch) =>
                          getVisibleInstanceIndices?.(batch).length ??
                          batch.instanceIds.length,
                      previewInstanceCount: profileMetrics.previewInstanceCount,
                      resolution,
                  })
                : null,
        [batches, getVisibleInstanceIndices, profileMetrics, resolution],
    );
    useEffect(() => {
        if (!measuredProfile || !profileMetrics) {
            return;
        }
        const { fallback, preview, production } = measuredProfile;
        updateGameProfileMetadata({
            gardenStructureAssetBytesResident:
                production.attributeBytes +
                production.indexBytes +
                production.textureEstimatedBytes +
                production.instanceBufferBytes,
            gardenStructureAssetResolutionIssueCount:
                measuredProfile.resolutionIssueCount,
            gardenStructureAssetResolutionStatus: 'resolved',
            gardenStructureAssetUnresolvedBatchCount:
                measuredProfile.unresolvedBatchCount,
            gardenStructureAssetUrl: profileMetrics.assetUrl,
            gardenStructureFallbackAttributeBytes: fallback.attributeBytes,
            gardenStructureFallbackDrawCount: fallback.drawCount,
            gardenStructureFallbackIndexBytes: fallback.indexBytes,
            gardenStructureFallbackInstanceBufferBytes:
                fallback.instanceBufferBytes,
            gardenStructureFallbackInstanceCount: fallback.instanceCount,
            gardenStructureFallbackTriangleCount: fallback.triangleCount,
            gardenStructureFallbackVertexCount: fallback.vertexCount,
            gardenStructurePreviewAttributeBytes: preview.attributeBytes,
            gardenStructurePreviewDrawCount: preview.drawCount,
            gardenStructurePreviewIndexBytes: preview.indexBytes,
            gardenStructurePreviewInstanceBufferBytes:
                preview.instanceBufferBytes,
            gardenStructurePreviewInstanceCount: preview.instanceCount,
            gardenStructurePreviewTriangleCount: preview.triangleCount,
            gardenStructurePreviewVertexCount: preview.vertexCount,
            gardenStructureProductionAttributeBytes: production.attributeBytes,
            gardenStructureProductionDrawCount: production.drawCount,
            gardenStructureProductionIndexBytes: production.indexBytes,
            gardenStructureProductionInstanceBufferBytes:
                production.instanceBufferBytes,
            gardenStructureProductionInstanceCount: production.instanceCount,
            gardenStructureProductionOpaqueDrawCount:
                production.opaqueDrawCount,
            gardenStructureProductionTextureCount: production.textureCount,
            gardenStructureProductionTextureEstimatedBytes:
                production.textureEstimatedBytes,
            gardenStructureProductionTransparentDrawCount:
                production.transparentDrawCount,
            gardenStructureProductionTriangleCount: production.triangleCount,
            gardenStructureProductionVertexCount: production.vertexCount,
            gardenStructureRenderBatchCount:
                production.drawCount + fallback.drawCount + preview.drawCount,
            gardenStructureRenderInstanceCount:
                production.instanceCount +
                fallback.instanceCount +
                preview.instanceCount,
            gardenStructureRenderTriangleCount:
                production.triangleCount +
                fallback.triangleCount +
                preview.triangleCount,
            gardenStructureRenderVertexCount:
                production.vertexCount +
                fallback.vertexCount +
                preview.vertexCount,
        });
        return () =>
            updateGameProfileMetadata({
                gardenStructureAssetBytesResident: 0,
                gardenStructureAssetResolutionIssueCount: 0,
                gardenStructureAssetResolutionStatus: 'idle',
                gardenStructureAssetUnresolvedBatchCount: 0,
                gardenStructureAssetUrl: '',
                gardenStructureFallbackAttributeBytes: 0,
                gardenStructureFallbackDrawCount: 0,
                gardenStructureFallbackIndexBytes: 0,
                gardenStructureFallbackInstanceBufferBytes: 0,
                gardenStructureFallbackInstanceCount: 0,
                gardenStructureFallbackTriangleCount: 0,
                gardenStructureFallbackVertexCount: 0,
                gardenStructurePreviewAttributeBytes: 0,
                gardenStructurePreviewDrawCount: 0,
                gardenStructurePreviewIndexBytes: 0,
                gardenStructurePreviewInstanceBufferBytes: 0,
                gardenStructurePreviewInstanceCount: 0,
                gardenStructurePreviewTriangleCount: 0,
                gardenStructurePreviewVertexCount: 0,
                gardenStructureProductionAttributeBytes: 0,
                gardenStructureProductionDrawCount: 0,
                gardenStructureProductionIndexBytes: 0,
                gardenStructureProductionInstanceBufferBytes: 0,
                gardenStructureProductionInstanceCount: 0,
                gardenStructureProductionOpaqueDrawCount: 0,
                gardenStructureProductionTextureCount: 0,
                gardenStructureProductionTextureEstimatedBytes: 0,
                gardenStructureProductionTransparentDrawCount: 0,
                gardenStructureProductionTriangleCount: 0,
                gardenStructureProductionVertexCount: 0,
                gardenStructureRenderBatchCount: 0,
                gardenStructureRenderInstanceCount: 0,
                gardenStructureRenderTriangleCount: 0,
                gardenStructureRenderVertexCount: 0,
            });
    }, [measuredProfile, profileMetrics]);
    const commonProps = {
        baseHeight,
        castShadows,
        getVisibleInstanceIndices,
        namePrefix,
        onSelectInstance,
        selectedInstanceId,
    };

    return (
        <group
            dispose={null}
            name={`${namePrefix}:Asset`}
            userData={{
                assetName: 'GardenStructureKitV1',
                opaqueDrawCount: draws.opaque.length,
                resolutionIssueCount: resolution.issues.length,
                semanticFallback: false,
                transparentDrawCount: draws.transparent.length,
                unresolvedBatchCount: draws.unresolved.length,
            }}
        >
            <group dispose={null} name={`${namePrefix}:OpaquePass`}>
                {draws.opaque.map((draw) => (
                    <GardenStructureKitV1PrimitiveInstances
                        {...commonProps}
                        draw={draw}
                        key={draw.id}
                    />
                ))}
            </group>
            <group dispose={null} name={`${namePrefix}:TransparentPass`}>
                {draws.transparent.map((draw) => (
                    <GardenStructureKitV1PrimitiveInstances
                        {...commonProps}
                        draw={draw}
                        key={draw.id}
                    />
                ))}
            </group>
            {draws.unresolved.length > 0
                ? renderFallback(draws.unresolved.map(({ id }) => id))
                : null}
        </group>
    );
}

type GardenStructureKitV1LoadedInstancesProps = Omit<
    Parameters<typeof GardenStructureKitV1ResolvedInstances>[0],
    'profileMetrics' | 'resolution'
> &
    Readonly<{
        onInstancesReady?: () => void;
        profileMetrics?: Omit<
            GardenStructureKitV1ResolvedProfileMetrics,
            'assetUrl'
        >;
    }>;

export function GardenStructureKitV1LoadedInstances({
    onInstancesReady,
    profileMetrics,
    ...props
}: GardenStructureKitV1LoadedInstancesProps) {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const gltf = useGameGLTF('GardenStructureKitV1');
    const resolution = useMemo(
        () => resolveGardenStructureKitV1Asset(gltf.scene),
        [gltf.scene],
    );

    useEffect(() => {
        onInstancesReady?.();
    }, [onInstancesReady]);
    const resolvedProfileMetrics = useMemo(
        () =>
            profileMetrics
                ? {
                      ...profileMetrics,
                      assetUrl: resolveGameAssetModelUrl(
                          appBaseUrl,
                          'GardenStructureKitV1',
                      ),
                  }
                : undefined,
        [appBaseUrl, profileMetrics],
    );

    return (
        <GardenStructureKitV1ResolvedInstances
            {...props}
            profileMetrics={resolvedProfileMetrics}
            resolution={resolution}
        />
    );
}
