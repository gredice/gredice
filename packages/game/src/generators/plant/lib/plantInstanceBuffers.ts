import * as THREE from 'three';
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
