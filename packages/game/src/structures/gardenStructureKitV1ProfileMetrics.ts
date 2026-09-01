import {
    type BufferAttribute,
    type BufferGeometry,
    InterleavedBufferAttribute,
    type Material,
    Texture,
} from 'three';
import {
    type GardenStructureKitV1AssetResolution,
    type GardenStructureKitV1BatchGeometryReference,
    resolveGardenStructureKitV1BatchGeometry,
} from './gardenStructureKitV1AssetResolver';
import { gardenStructureKitV1Metadata } from './gardenStructureKitV1Manifest';

const instanceMatrixBytes = 16 * Float32Array.BYTES_PER_ELEMENT;
const instanceColorBytes = 3 * Float32Array.BYTES_PER_ELEMENT;

type ProfileRuntimeBatch = GardenStructureKitV1BatchGeometryReference &
    Readonly<{
        id: string;
        instanceIds: readonly string[];
        transforms: Float32Array;
        transformStride: 3 | 4;
    }>;

type GeometryCpuBytes = Readonly<{
    attributeBytes: number;
    indexBytes: number;
}>;

type ArrayByteRanges = Map<
    ArrayBufferLike,
    readonly Readonly<{ end: number; start: number }>[]
>;

export type GardenStructureRenderProfilePass = Readonly<{
    attributeBytes: number;
    drawCount: number;
    indexBytes: number;
    instanceBufferBytes: number;
    instanceCount: number;
    triangleCount: number;
    vertexCount: number;
}>;

export type GardenStructureKitV1ProfileMetrics = Readonly<{
    fallback: GardenStructureRenderProfilePass;
    preview: GardenStructureRenderProfilePass;
    production: GardenStructureRenderProfilePass &
        Readonly<{
            opaqueDrawCount: number;
            textureCount: number;
            textureEstimatedBytes: number;
            transparentDrawCount: number;
        }>;
    resident: Readonly<{
        attributeBytes: number;
        indexBytes: number;
        textureCount: number;
        textureEstimatedBytes: number;
    }>;
    resolutionIssueCount: number;
    unresolvedBatchCount: number;
}>;

function attributeArray(
    attribute: BufferAttribute | InterleavedBufferAttribute,
) {
    return attribute instanceof InterleavedBufferAttribute
        ? attribute.data.array
        : attribute.array;
}

function addUniqueArrayBytes(
    attribute: BufferAttribute | InterleavedBufferAttribute,
    rangesByBuffer: ArrayByteRanges,
) {
    const array = attributeArray(attribute);
    const start = array.byteOffset;
    const end = start + array.byteLength;
    const ranges = rangesByBuffer.get(array.buffer) ?? [];
    let addedBytes = array.byteLength;
    for (const range of ranges) {
        addedBytes -= Math.max(
            0,
            Math.min(end, range.end) - Math.max(start, range.start),
        );
    }
    const mergedRanges: { end: number; start: number }[] = [];
    let merged = { end, start };
    for (const range of ranges) {
        if (range.end < merged.start || range.start > merged.end) {
            mergedRanges.push(range);
            continue;
        }
        merged = {
            end: Math.max(merged.end, range.end),
            start: Math.min(merged.start, range.start),
        };
    }
    mergedRanges.push(merged);
    mergedRanges.sort((left, right) => left.start - right.start);
    rangesByBuffer.set(array.buffer, mergedRanges);
    return addedBytes;
}

export function getGardenStructureGeometryCpuBytes(
    geometry: BufferGeometry,
): GeometryCpuBytes {
    const attributeRanges: ArrayByteRanges = new Map();
    const indexRanges: ArrayByteRanges = new Map();
    return getGeometryCpuBytes(geometry, attributeRanges, indexRanges);
}

function getGeometryCpuBytes(
    geometry: BufferGeometry,
    attributeRanges: ArrayByteRanges,
    indexRanges: ArrayByteRanges,
): GeometryCpuBytes {
    let attributeBytes = 0;
    for (const attribute of Object.values(geometry.attributes)) {
        attributeBytes += addUniqueArrayBytes(attribute, attributeRanges);
    }
    for (const attributes of Object.values(geometry.morphAttributes)) {
        for (const attribute of attributes) {
            attributeBytes += addUniqueArrayBytes(attribute, attributeRanges);
        }
    }

    const indexBytes = geometry.index
        ? addUniqueArrayBytes(geometry.index, indexRanges)
        : 0;
    return Object.freeze({ attributeBytes, indexBytes });
}

function isSemanticFallbackBatch(batch: ProfileRuntimeBatch) {
    return !(
        batch.geometryKind === 'edge-segment' &&
        gardenStructureKitV1Metadata.edgeParts[batch.geometryId]?.passage ===
            'open-portal'
    );
}

function geometryCounts(geometry: BufferGeometry) {
    const vertexCount = geometry.getAttribute('position')?.count ?? 0;
    const triangleCount = Math.floor(
        (geometry.index?.count ?? vertexCount) / 3,
    );
    return { triangleCount, vertexCount };
}

function textureDimensions(value: unknown) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const width = Reflect.get(value, 'width');
    const height = Reflect.get(value, 'height');
    const depth = Reflect.get(value, 'depth');
    if (typeof width !== 'number' || typeof height !== 'number') {
        return null;
    }
    return {
        depth: typeof depth === 'number' ? depth : 1,
        height,
        width,
    };
}

function estimateTextureBytes(texture: Texture) {
    const images = Array.isArray(texture.image)
        ? texture.image
        : [texture.source.data ?? texture.image];
    const baseBytes = images.reduce((total, image) => {
        const dimensions = textureDimensions(image);
        return dimensions
            ? total +
                  dimensions.width * dimensions.height * dimensions.depth * 4
            : total;
    }, 0);
    return texture.generateMipmaps ? Math.ceil((baseBytes * 4) / 3) : baseBytes;
}

function collectMaterialTextures(
    material: Material | Material[],
    textures: Set<Texture>,
) {
    for (const entry of Array.isArray(material) ? material : [material]) {
        for (const value of Object.values(entry)) {
            if (value instanceof Texture) {
                textures.add(value);
            }
        }
    }
}

function measureResolvedAssetResidentBytes(
    resolution: GardenStructureKitV1AssetResolution,
) {
    const geometries = new Set<BufferGeometry>();
    const textures = new Set<Texture>();
    for (const resolved of resolution.geometries.values()) {
        if (resolved.status !== 'resolved') {
            continue;
        }
        for (const primitive of resolved.primitives) {
            geometries.add(primitive.geometry);
            collectMaterialTextures(primitive.material, textures);
        }
    }

    const attributeRanges: ArrayByteRanges = new Map();
    const indexRanges: ArrayByteRanges = new Map();
    let attributeBytes = 0;
    let indexBytes = 0;
    for (const geometry of geometries) {
        const bytes = getGeometryCpuBytes(
            geometry,
            attributeRanges,
            indexRanges,
        );
        attributeBytes += bytes.attributeBytes;
        indexBytes += bytes.indexBytes;
    }

    return Object.freeze({
        attributeBytes,
        indexBytes,
        textureCount: textures.size,
        textureEstimatedBytes: [...textures].reduce(
            (total, texture) => total + estimateTextureBytes(texture),
            0,
        ),
    });
}

function emptyPass(): {
    attributeBytes: number;
    drawCount: number;
    indexBytes: number;
    instanceBufferBytes: number;
    instanceCount: number;
    triangleCount: number;
    vertexCount: number;
} {
    return {
        attributeBytes: 0,
        drawCount: 0,
        indexBytes: 0,
        instanceBufferBytes: 0,
        instanceCount: 0,
        triangleCount: 0,
        vertexCount: 0,
    };
}

function addGeometryToPass(
    pass: ReturnType<typeof emptyPass>,
    geometry: BufferGeometry,
    instanceCount: number,
    drawCount = 1,
    instanceBufferCapacity = instanceCount,
) {
    const counts = geometryCounts(geometry);
    pass.drawCount += instanceCount > 0 ? drawCount : 0;
    pass.instanceCount += instanceCount;
    pass.vertexCount += counts.vertexCount * instanceCount;
    pass.triangleCount += counts.triangleCount * instanceCount;
    pass.instanceBufferBytes +=
        instanceBufferCapacity * (instanceMatrixBytes + instanceColorBytes);
}

export function measureGardenStructureKitV1ProfileMetrics({
    batches,
    fallbackGeometry,
    getVisibleInstanceCount,
    previewInstanceCount,
    resolution,
}: Readonly<{
    batches: readonly ProfileRuntimeBatch[];
    fallbackGeometry: BufferGeometry;
    getVisibleInstanceCount?: (batch: ProfileRuntimeBatch) => number;
    previewInstanceCount: number;
    resolution: GardenStructureKitV1AssetResolution;
}>): GardenStructureKitV1ProfileMetrics {
    const fallback = emptyPass();
    const preview = emptyPass();
    const production = emptyPass();
    const productionGeometries = new Set<BufferGeometry>();
    const fallbackGeometries = new Set<BufferGeometry>();
    const textures = new Set<Texture>();
    let opaqueDrawCount = 0;
    let transparentDrawCount = 0;
    let unresolvedBatchCount = 0;

    for (const batch of batches) {
        const visibleInstanceCount = Math.max(
            0,
            Math.min(
                batch.instanceIds.length,
                Math.floor(
                    getVisibleInstanceCount?.(batch) ??
                        batch.instanceIds.length,
                ),
            ),
        );
        const geometry = resolveGardenStructureKitV1BatchGeometry(
            resolution,
            batch,
        );
        if (!geometry || geometry.status === 'missing') {
            unresolvedBatchCount += 1;
            if (isSemanticFallbackBatch(batch)) {
                addGeometryToPass(
                    fallback,
                    fallbackGeometry,
                    visibleInstanceCount,
                    1,
                    batch.instanceIds.length,
                );
                fallbackGeometries.add(fallbackGeometry);
            }
            continue;
        }
        for (const primitive of geometry.primitives) {
            const drawCount = Array.isArray(primitive.material)
                ? Math.max(1, primitive.geometry.groups.length)
                : 1;
            addGeometryToPass(
                production,
                primitive.geometry,
                visibleInstanceCount,
                drawCount,
                batch.instanceIds.length,
            );
            productionGeometries.add(primitive.geometry);
            collectMaterialTextures(primitive.material, textures);
            if (primitive.transparency === 'transparent') {
                transparentDrawCount +=
                    visibleInstanceCount > 0 ? drawCount : 0;
            } else {
                opaqueDrawCount += visibleInstanceCount > 0 ? drawCount : 0;
            }
        }
    }

    const productionAttributeRanges: ArrayByteRanges = new Map();
    const productionIndexRanges: ArrayByteRanges = new Map();
    for (const geometry of productionGeometries) {
        const bytes = getGeometryCpuBytes(
            geometry,
            productionAttributeRanges,
            productionIndexRanges,
        );
        production.attributeBytes += bytes.attributeBytes;
        production.indexBytes += bytes.indexBytes;
    }
    const fallbackAttributeRanges: ArrayByteRanges = new Map();
    const fallbackIndexRanges: ArrayByteRanges = new Map();
    for (const geometry of fallbackGeometries) {
        const bytes = getGeometryCpuBytes(
            geometry,
            fallbackAttributeRanges,
            fallbackIndexRanges,
        );
        fallback.attributeBytes += bytes.attributeBytes;
        fallback.indexBytes += bytes.indexBytes;
    }
    if (previewInstanceCount > 0) {
        addGeometryToPass(preview, fallbackGeometry, previewInstanceCount);
        const bytes = getGardenStructureGeometryCpuBytes(fallbackGeometry);
        preview.attributeBytes = bytes.attributeBytes;
        preview.indexBytes = bytes.indexBytes;
    }

    return Object.freeze({
        fallback: Object.freeze(fallback),
        preview: Object.freeze(preview),
        production: Object.freeze({
            ...production,
            opaqueDrawCount,
            textureCount: textures.size,
            textureEstimatedBytes: [...textures].reduce(
                (total, texture) => total + estimateTextureBytes(texture),
                0,
            ),
            transparentDrawCount,
        }),
        resident: measureResolvedAssetResidentBytes(resolution),
        resolutionIssueCount: resolution.issues.length,
        unresolvedBatchCount,
    });
}
