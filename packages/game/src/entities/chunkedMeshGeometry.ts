import { BufferGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import {
    compileMeshBuffers,
    packMeshGeometry,
    unpackMeshGeometry,
} from '../scene/compiler/meshBuffers';

export const meshChunkSize = 8;

export type ChunkedMeshInstance = {
    position: [number, number, number];
    rotation: number;
};

export type MeshInstanceChunk<T extends ChunkedMeshInstance> = {
    key: string;
    instances: T[];
    version?: number;
};

export type MeshInstanceLocalTransform = {
    position: [number, number, number];
    rotation: [number, number, number];
};

export type MeshInstanceScale = number | [number, number, number] | undefined;

export function chunkInstanceKey(
    position: [number, number, number],
    chunkSize = meshChunkSize,
) {
    return `${Math.floor(position[0] / chunkSize)}:${Math.floor(
        position[2] / chunkSize,
    )}`;
}

export function chunkMeshInstances<T extends ChunkedMeshInstance>(
    instances: T[],
    chunkSize = meshChunkSize,
    previous: MeshInstanceChunk<T>[] = [],
    equal: (left: T, right: T) => boolean = Object.is,
) {
    const chunkByKey = new Map<string, T[]>();

    for (const instance of instances) {
        const key = chunkInstanceKey(instance.position, chunkSize);
        const chunk = chunkByKey.get(key);
        if (chunk) {
            chunk.push(instance);
            continue;
        }
        chunkByKey.set(key, [instance]);
    }

    const previousByKey = new Map(previous.map((chunk) => [chunk.key, chunk]));
    const chunks = [...chunkByKey.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, instances]): MeshInstanceChunk<T> => {
            const old = previousByKey.get(key);
            return old &&
                old.instances.length === instances.length &&
                instances.every((instance, index) =>
                    equal(instance, old.instances[index]),
                )
                ? old
                : { key, instances, version: (old?.version ?? 0) + 1 };
        });
    return chunks.length === previous.length &&
        chunks.every((chunk, index) => chunk === previous[index])
        ? previous
        : chunks;
}

export function createMeshInstanceMatrix(
    instance: ChunkedMeshInstance,
    localTransform: MeshInstanceLocalTransform,
    scale: MeshInstanceScale,
) {
    const rootPosition = new Vector3(...instance.position);
    const rootQuaternion = new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        instance.rotation * (Math.PI / 2),
    );
    const rootMatrix = new Matrix4().compose(
        rootPosition,
        rootQuaternion,
        new Vector3(1, 1, 1),
    );
    const localPosition = new Vector3(...localTransform.position);
    const localQuaternion = new Quaternion().setFromEuler(
        new Euler(...localTransform.rotation),
    );
    const localScale = Array.isArray(scale)
        ? new Vector3(scale[0], scale[1], scale[2])
        : new Vector3(scale ?? 1, scale ?? 1, scale ?? 1);
    const localMatrix = new Matrix4().compose(
        localPosition,
        localQuaternion,
        localScale,
    );

    return rootMatrix.multiply(localMatrix);
}

export function createMergedChunkGeometry<T extends ChunkedMeshInstance>({
    geometry,
    instances,
    localTransform,
    scale,
}: {
    geometry: BufferGeometry;
    instances: T[];
    localTransform: MeshInstanceLocalTransform;
    scale: MeshInstanceScale;
}) {
    if (instances.length === 0) {
        return new BufferGeometry();
    }

    return unpackMeshGeometry(
        compileMeshBuffers(
            packMeshGeometry(geometry),
            createChunkMatrices(instances, localTransform, scale),
        ),
    );
}

export function createChunkMatrices(
    instances: ChunkedMeshInstance[],
    localTransform: MeshInstanceLocalTransform,
    scale: MeshInstanceScale,
) {
    const matrices = new Float64Array(instances.length * 16);
    instances.forEach((instance, index) => {
        createMeshInstanceMatrix(instance, localTransform, scale).toArray(
            matrices,
            index * 16,
        );
    });
    return matrices;
}
