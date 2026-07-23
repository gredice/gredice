import * as THREE from 'three';
import type { PackedPlantBounds } from './packedPlantRenderData';
import { generatedPlantInstanceBufferMetrics } from './plantInstanceBufferMetrics';

function assertNonNegativeInteger(value: number, label: string) {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`${label} must be a non-negative integer.`);
    }
}

export function createStaticInstancedBufferAttribute(
    instanceCapacity: number,
    itemSize: number,
) {
    assertNonNegativeInteger(
        instanceCapacity,
        'Plant instance-buffer capacity',
    );
    if (!Number.isInteger(itemSize) || itemSize <= 0) {
        throw new RangeError(
            'Plant instance-buffer item size must be a positive integer.',
        );
    }

    return new THREE.InstancedBufferAttribute(
        new Float32Array(instanceCapacity * itemSize),
        itemSize,
    ).setUsage(THREE.StaticDrawUsage);
}

export function markStaticInstancedAttributeForUpload(
    attribute: THREE.InstancedBufferAttribute,
    liveCount: number,
) {
    assertNonNegativeInteger(liveCount, 'Plant instance-buffer live count');
    if (liveCount > attribute.count) {
        throw new RangeError(
            `Plant instance-buffer live count ${liveCount.toString()} exceeds capacity ${attribute.count.toString()}.`,
        );
    }
    if (attribute.version > 0 && attribute.usage !== THREE.StaticDrawUsage) {
        throw new Error(
            'Plant instance-buffer usage cannot change after its first upload.',
        );
    }

    attribute.setUsage(THREE.StaticDrawUsage);
    attribute.clearUpdateRanges();
    const componentCount = liveCount * attribute.itemSize;
    if (componentCount > 0) {
        attribute.addUpdateRange(0, componentCount);
    }
    attribute.needsUpdate = true;
    generatedPlantInstanceBufferMetrics.recordUpload(
        componentCount * attribute.array.BYTES_PER_ELEMENT,
    );
}

export function finalizeStaticInstanceMatrixUpload(
    mesh: THREE.InstancedMesh,
    liveCount: number,
) {
    markStaticInstancedAttributeForUpload(mesh.instanceMatrix, liveCount);
    mesh.count = liveCount;
    mesh.visible = liveCount > 0;
}

export function copyPackedStaticInstancedAttribute(
    attribute: THREE.InstancedBufferAttribute,
    source: Float32Array,
    liveCount: number,
) {
    const expectedComponentCount = liveCount * attribute.itemSize;
    if (source.length !== expectedComponentCount) {
        throw new RangeError(
            `Packed plant attribute contains ${source.length.toString()} components; expected ${expectedComponentCount.toString()}.`,
        );
    }
    if (!(attribute.array instanceof Float32Array)) {
        throw new TypeError('Packed plant attributes require Float32 storage.');
    }

    attribute.array.set(source);
    markStaticInstancedAttributeForUpload(attribute, liveCount);
}

export function copyPackedStaticInstanceMatrices(
    mesh: THREE.InstancedMesh,
    matrices: Float32Array,
    liveCount: number,
) {
    copyPackedStaticInstancedAttribute(
        mesh.instanceMatrix,
        matrices,
        liveCount,
    );
    mesh.count = liveCount;
    mesh.visible = liveCount > 0;
}

export function applyPackedPlantBounds(
    mesh: THREE.InstancedMesh,
    bounds: PackedPlantBounds,
) {
    mesh.boundingBox ??= new THREE.Box3();
    mesh.boundingBox.min.set(...bounds.boxMin);
    mesh.boundingBox.max.set(...bounds.boxMax);
    mesh.boundingSphere ??= new THREE.Sphere();
    mesh.boundingSphere.center.set(...bounds.sphereCenter);
    mesh.boundingSphere.radius = bounds.sphereRadius;
}

/**
 * Creates a batch-local geometry shell while retaining immutable topology
 * attributes from a shared source geometry. Custom instance attributes can
 * then be attached without cloning or mutating the shared vertex buffers.
 */
export function createPlantGeometryShell(source: THREE.BufferGeometry) {
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(source.index);
    for (const [attributeName, attribute] of Object.entries(
        source.attributes,
    )) {
        geometry.setAttribute(attributeName, attribute);
    }
    for (const group of source.groups) {
        geometry.addGroup(group.start, group.count, group.materialIndex);
    }
    geometry.setDrawRange(source.drawRange.start, source.drawRange.count);
    geometry.boundingBox = source.boundingBox?.clone() ?? null;
    geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
    return geometry;
}

export function disposePlantGeometryShell(
    geometry: THREE.BufferGeometry,
    source: THREE.BufferGeometry,
) {
    if (geometry.index === source.index) {
        geometry.setIndex(null);
    }
    for (const attributeName of Object.keys(geometry.attributes)) {
        if (
            geometry.getAttribute(attributeName) ===
            source.getAttribute(attributeName)
        ) {
            geometry.deleteAttribute(attributeName);
        }
    }
    geometry.clearGroups();
    geometry.dispose();
}
