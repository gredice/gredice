'use client';

import { useEffect, useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import { useGameState } from '../useGameState';
import { resolveGameAssetModelUrl } from '../utils/useGameGLTF';
import type { GardenStructureKitV1RuntimeBatch } from './GardenStructureKitV1AssetRenderer';
import type { GardenStructureKitV1AssetResolution } from './gardenStructureKitV1AssetResolver';
import { measureGardenStructureKitV1ProfileMetrics } from './gardenStructureKitV1ProfileMetrics';

export function GardenStructureKitV1ProfileMetricsReporter({
    batches,
    fallbackGeometry,
    getVisibleInstanceIndices,
    previewInstanceCount,
    resolution,
}: Readonly<{
    batches: readonly GardenStructureKitV1RuntimeBatch[];
    fallbackGeometry: BufferGeometry;
    getVisibleInstanceIndices?: (
        batch: GardenStructureKitV1RuntimeBatch,
    ) => readonly number[];
    previewInstanceCount: number;
    resolution: GardenStructureKitV1AssetResolution;
}>) {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const assetUrl = useMemo(
        () => resolveGameAssetModelUrl(appBaseUrl, 'GardenStructureKitV1'),
        [appBaseUrl],
    );
    const measuredProfile = useMemo(
        () =>
            measureGardenStructureKitV1ProfileMetrics({
                batches,
                fallbackGeometry,
                getVisibleInstanceCount: (batch) =>
                    getVisibleInstanceIndices?.(batch).length ??
                    batch.instanceIds.length,
                previewInstanceCount,
                resolution,
            }),
        [
            batches,
            fallbackGeometry,
            getVisibleInstanceIndices,
            previewInstanceCount,
            resolution,
        ],
    );

    useEffect(() => {
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
            gardenStructureAssetUrl: assetUrl,
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
    }, [assetUrl, measuredProfile]);

    return null;
}
