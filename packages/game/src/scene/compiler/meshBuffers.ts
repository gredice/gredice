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

export function meshGeometryComponentCount(geometry: BufferGeometry) {
    const attributes = [
        ...Object.values(geometry.attributes),
        ...Object.values(geometry.morphAttributes).flat(),
    ];
    return attributes.reduce(
        (total, attribute) => total + attribute.count * attribute.itemSize,
        geometry.index?.count ?? 0,
    );
}

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
            attribute.array.set(packed.array, packed.array.length * instance);
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
    return withMeshBounds(result);
}

function withMeshBounds(result: PackedMeshGeometry) {
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

function attributeLayoutSignature(
    attribute: BufferAttribute | InterleavedBufferAttribute,
) {
    const gpuType = 'gpuType' in attribute ? attribute.gpuType : 'default';
    return `${attribute.array.constructor.name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}:${attribute instanceof Float16BufferAttribute ? 16 : 0}:${gpuType}`;
}

/**
 * Geometries with equal signatures produce packed buffers that can be
 * concatenated without converting, dropping, or synthesizing attributes.
 */
export function meshGeometryLayoutSignature(geometry: BufferGeometry) {
    const attributes = Object.entries(geometry.attributes)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
            ([name, attribute]) =>
                `${name}=${attributeLayoutSignature(attribute)}`,
        );
    const morphAttributes = Object.entries(geometry.morphAttributes)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
            ([name, targets]) =>
                `${name}[${targets.map(attributeLayoutSignature).join('|')}]`,
        );
    return `${geometry.index ? 'indexed' : 'direct'};${attributes.join(';')};morph:${geometry.morphTargetsRelative ? 'relative' : 'absolute'}:${morphAttributes.join(';')}`;
}

function concatAttributes(attributes: PackedMeshAttribute[]) {
    const first = attributes[0];
    if (!first) throw new Error('Cannot concatenate an empty attribute set.');
    const length = attributes.reduce(
        (total, attribute) => total + attribute.array.length,
        0,
    );
    const array = allocateLike(first.array, length);
    let offset = 0;
    for (const attribute of attributes) {
        array.set(attribute.array, offset);
        offset += attribute.array.length;
    }
    return { ...first, array };
}

/**
 * Concatenates already-transformed packets that share one layout into a
 * single draw. Index values are rebased per source; vertex data is copied
 * once with no per-source BufferGeometry.
 */
export function concatMeshBuffers(
    packets: PackedMeshGeometry[],
): PackedMeshGeometry {
    const [first] = packets;
    if (!first) throw new Error('Cannot concatenate zero mesh packets.');
    if (packets.length === 1) return first;
    const names = Object.keys(first.attributes).sort();
    const morphNames = Object.keys(first.morphAttributes).sort();
    const vertexCounts = packets.map((packet) => {
        const position = packet.attributes.position;
        return position ? position.array.length / position.itemSize : 0;
    });
    const totalVertices = vertexCounts.reduce(
        (total, count) => total + count,
        0,
    );
    for (const packet of packets) {
        const packetNames = Object.keys(packet.attributes).sort();
        if (
            packetNames.join('|') !== names.join('|') ||
            Object.keys(packet.morphAttributes).sort().join('|') !==
                morphNames.join('|') ||
            Boolean(packet.index) !== Boolean(first.index) ||
            packet.morphTargetsRelative !== first.morphTargetsRelative
        )
            throw new Error(
                'Cannot concatenate mesh packets with different layouts.',
            );
    }
    let index: Uint16Array | Uint32Array | null = null;
    if (first.index) {
        const length = packets.reduce(
            (total, packet) => total + (packet.index?.length ?? 0),
            0,
        );
        index =
            totalVertices > 65535
                ? new Uint32Array(length)
                : new Uint16Array(length);
        let offset = 0;
        let base = 0;
        packets.forEach((packet, packetIndex) => {
            const source = packet.index;
            if (source && index) {
                for (let i = 0; i < source.length; i++)
                    index[offset + i] = source[i] + base;
                offset += source.length;
            }
            base += vertexCounts[packetIndex] ?? 0;
        });
    }
    return withMeshBounds({
        attributes: Object.fromEntries(
            names.map((name) => [
                name,
                concatAttributes(
                    packets.map((packet) => packet.attributes[name]),
                ),
            ]),
        ),
        morphAttributes: Object.fromEntries(
            morphNames.map((name) => [
                name,
                (first.morphAttributes[name] ?? []).map((_, target) =>
                    concatAttributes(
                        packets.map(
                            (packet) => packet.morphAttributes[name][target],
                        ),
                    ),
                ),
            ]),
        ),
        morphTargetsRelative: first.morphTargetsRelative,
        index,
    });
}

export type MeshBufferSource = {
    source: PackedMeshGeometry;
    matrices: Float64Array;
};

/** Transforms each source by its instance matrices and joins them into one draw. */
export function compileMeshBufferSources(sources: MeshBufferSource[]) {
    return concatMeshBuffers(
        sources.map(({ source, matrices }) =>
            compileMeshBuffers(source, matrices),
        ),
    );
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
