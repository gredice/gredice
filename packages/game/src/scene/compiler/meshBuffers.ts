import {
    Box3,
    BufferAttribute,
    BufferGeometry,
    Float16BufferAttribute,
    type InterleavedBufferAttribute,
    Matrix3,
    Matrix4,
    Sphere,
    type TypedArray,
    Vector3,
} from 'three';

export type PackedMeshAttribute = {
    array: TypedArray;
    itemSize: number;
    normalized: boolean;
    float16: boolean;
    gpuType: BufferAttribute['gpuType'];
};

export type PackedMeshGeometry = {
    attributes: Record<string, PackedMeshAttribute>;
    morphAttributes: Record<string, PackedMeshAttribute[]>;
    morphTargetsRelative: boolean;
    index: Uint16Array | Uint32Array | null;
    bounds?: { min: number[]; max: number[]; center: number[]; radius: number };
};

function allocateLike(array: TypedArray, length: number): TypedArray {
    if (array instanceof Float32Array) return new Float32Array(length);
    if (array instanceof Float64Array) return new Float64Array(length);
    if (array instanceof Uint32Array) return new Uint32Array(length);
    if (array instanceof Uint16Array) return new Uint16Array(length);
    if (array instanceof Uint8Array) return new Uint8Array(length);
    if (array instanceof Uint8ClampedArray)
        return new Uint8ClampedArray(length);
    if (array instanceof Int32Array) return new Int32Array(length);
    if (array instanceof Int16Array) return new Int16Array(length);
    return new Int8Array(length);
}

function packAttribute(
    attribute: BufferAttribute | InterleavedBufferAttribute,
): PackedMeshAttribute {
    const array = allocateLike(
        attribute.array,
        attribute.count * attribute.itemSize,
    );
    if ('isInterleavedBufferAttribute' in attribute) {
        for (let i = 0; i < attribute.count; i++) {
            for (let c = 0; c < attribute.itemSize; c++) {
                array[i * attribute.itemSize + c] =
                    attribute.array[
                        i * attribute.data.stride + attribute.offset + c
                    ];
            }
        }
    } else array.set(attribute.array);
    return {
        array,
        itemSize: attribute.itemSize,
        normalized: attribute.normalized,
        float16: attribute instanceof Float16BufferAttribute,
        gpuType:
            'gpuType' in attribute
                ? attribute.gpuType
                : new BufferAttribute(array, 1).gpuType,
    };
}

/** Copies each shared source buffer once; transferring this never detaches a GLTF. */
export function packMeshGeometry(geometry: BufferGeometry): PackedMeshGeometry {
    return {
        attributes: Object.fromEntries(
            Object.entries(geometry.attributes).map(([name, attribute]) => [
                name,
                packAttribute(attribute),
            ]),
        ),
        morphAttributes: Object.fromEntries(
            Object.entries(geometry.morphAttributes).map(
                ([name, attributes]) => [name, attributes.map(packAttribute)],
            ),
        ),
        morphTargetsRelative: geometry.morphTargetsRelative,
        index: geometry.index ? new Uint32Array(geometry.index.array) : null,
    };
}

function unpackAttribute(packed: PackedMeshAttribute) {
    const attribute = packed.float16
        ? new Float16BufferAttribute(
              packed.array,
              packed.itemSize,
              packed.normalized,
          )
        : new BufferAttribute(packed.array, packed.itemSize, packed.normalized);
    attribute.gpuType = packed.gpuType;
    return attribute;
}

export function unpackMeshGeometry(packed: PackedMeshGeometry) {
    const geometry = new BufferGeometry();
    for (const [name, attribute] of Object.entries(packed.attributes))
        geometry.setAttribute(name, unpackAttribute(attribute));
    geometry.morphAttributes = Object.fromEntries(
        Object.entries(packed.morphAttributes).map(([name, attributes]) => [
            name,
            attributes.map(unpackAttribute),
        ]),
    );
    geometry.morphTargetsRelative = packed.morphTargetsRelative;
    if (packed.index) geometry.setIndex(new BufferAttribute(packed.index, 1));
    if (packed.bounds) {
        geometry.boundingBox = new Box3(
            new Vector3().fromArray(packed.bounds.min),
            new Vector3().fromArray(packed.bounds.max),
        );
        geometry.boundingSphere = new Sphere(
            new Vector3().fromArray(packed.bounds.center),
            packed.bounds.radius,
        );
    }
    return geometry;
}

/** One allocation per output attribute, no per-instance BufferGeometry or clone. */
export function compileMeshBuffers(
    source: PackedMeshGeometry,
    matrices: Float64Array,
): PackedMeshGeometry {
    const count = matrices.length / 16;
    const matrix = new Matrix4();
    const normalMatrix = new Matrix3();
    const vector = new Vector3();
    function repeatAttribute(
        packed: PackedMeshAttribute,
        name?: string,
    ): PackedMeshAttribute {
        const array = allocateLike(packed.array, packed.array.length * count);
        const result = { ...packed, array };
        const attribute = unpackAttribute(result);
        const vertices = packed.array.length / packed.itemSize;
        for (let instance = 0; instance < count; instance++) {
            array.set(packed.array, packed.array.length * instance);
            if (name !== 'position' && name !== 'normal' && name !== 'tangent')
                continue;
            matrix.fromArray(matrices, instance * 16);
            if (name === 'normal') normalMatrix.getNormalMatrix(matrix);
            for (
                let vertex = instance * vertices;
                vertex < (instance + 1) * vertices;
                vertex++
            ) {
                vector.fromBufferAttribute(attribute, vertex);
                if (name === 'position') vector.applyMatrix4(matrix);
                else if (name === 'normal')
                    vector.applyNormalMatrix(normalMatrix);
                else vector.transformDirection(matrix);
                attribute.setXYZ(vertex, vector.x, vector.y, vector.z);
            }
        }
        // Float16BufferAttribute copies its input in Three; return its actual storage.
        return { ...result, array: attribute.array };
    }
    const vertices = source.attributes.position
        ? source.attributes.position.array.length /
          source.attributes.position.itemSize
        : 0;
    const index = source.index
        ? vertices * count > 65535
            ? new Uint32Array(source.index.length * count)
            : new Uint16Array(source.index.length * count)
        : null;
    if (index && source.index) {
        for (let instance = 0; instance < count; instance++) {
            for (let i = 0; i < source.index.length; i++)
                index[instance * source.index.length + i] =
                    source.index[i] + instance * vertices;
        }
    }
    const result: PackedMeshGeometry = {
        attributes: Object.fromEntries(
            Object.entries(source.attributes).map(([name, attribute]) => [
                name,
                repeatAttribute(attribute, name),
            ]),
        ),
        // Three's applyMatrix4 deliberately leaves morph attributes in source space.
        morphAttributes: Object.fromEntries(
            Object.entries(source.morphAttributes).map(([name, attributes]) => [
                name,
                attributes.map((attribute) => repeatAttribute(attribute)),
            ]),
        ),
        morphTargetsRelative: source.morphTargetsRelative,
        index,
    };
    const geometry = unpackMeshGeometry(result);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    if (geometry.boundingBox && geometry.boundingSphere)
        result.bounds = {
            min: geometry.boundingBox.min.toArray(),
            max: geometry.boundingBox.max.toArray(),
            center: geometry.boundingSphere.center.toArray(),
            radius: geometry.boundingSphere.radius,
        };
    return result;
}

export function meshBufferTransferables(
    packed: PackedMeshGeometry,
): ArrayBuffer[] {
    const arrays = [
        ...Object.values(packed.attributes).map((attribute) => attribute.array),
        ...Object.values(packed.morphAttributes).flatMap((attributes) =>
            attributes.map((attribute) => attribute.array),
        ),
        ...(packed.index ? [packed.index] : []),
    ];
    return [
        ...new Set(
            arrays
                .map((array) => array.buffer)
                .filter(
                    (buffer): buffer is ArrayBuffer =>
                        buffer instanceof ArrayBuffer,
                ),
        ),
    ];
}

export function meshBufferByteLength(packed: PackedMeshGeometry) {
    return meshBufferTransferables(packed).reduce(
        (total, buffer) => total + buffer.byteLength,
        0,
    );
}
