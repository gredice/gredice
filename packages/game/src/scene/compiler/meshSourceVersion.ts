import {
    type BufferAttribute,
    type BufferGeometry,
    Float16BufferAttribute,
    type InterleavedBufferAttribute,
} from 'three';

function attributeVersion(
    attribute: BufferAttribute | InterleavedBufferAttribute,
) {
    const interleaved = 'isInterleavedBufferAttribute' in attribute;
    return {
        attribute,
        array: attribute.array,
        byteLength: attribute.array.byteLength,
        byteOffset: attribute.array.byteOffset,
        itemSize: attribute.itemSize,
        count: attribute.count,
        normalized: attribute.normalized,
        float16: attribute instanceof Float16BufferAttribute,
        gpuType: 'gpuType' in attribute ? attribute.gpuType : undefined,
        version: interleaved ? attribute.data.version : attribute.version,
        data: interleaved ? attribute.data : undefined,
        stride: interleaved ? attribute.data.stride : undefined,
        offset: interleaved ? attribute.offset : undefined,
    };
}

/**
 * The versioned contract requires needsUpdate after every in-place data edit
 * (data.needsUpdate for interleaved storage). Unversioned sources bypass reuse.
 * Layout, storage and attribute replacement are checked independently.
 */
export function meshSourceVersion(geometry: BufferGeometry) {
    return {
        attributes: Object.entries(geometry.attributes).map(
            ([name, attribute]) => ({
                name,
                ...attributeVersion(attribute),
            }),
        ),
        morphAttributes: Object.entries(geometry.morphAttributes).map(
            ([name, attributes]) => ({
                name,
                attributes: attributes.map(attributeVersion),
            }),
        ),
        index: geometry.index ? attributeVersion(geometry.index) : null,
        morphTargetsRelative: geometry.morphTargetsRelative,
    };
}

export type MeshSourceVersion = ReturnType<typeof meshSourceVersion>;

function currentAttribute(
    version: ReturnType<typeof attributeVersion>,
    attribute: BufferAttribute | InterleavedBufferAttribute | undefined,
) {
    if (!attribute) return false;
    const interleaved = 'isInterleavedBufferAttribute' in attribute;
    return (
        version.attribute === attribute &&
        version.array === attribute.array &&
        version.byteLength === attribute.array.byteLength &&
        version.byteOffset === attribute.array.byteOffset &&
        version.itemSize === attribute.itemSize &&
        version.count === attribute.count &&
        version.normalized === attribute.normalized &&
        version.float16 === attribute instanceof Float16BufferAttribute &&
        version.gpuType ===
            ('gpuType' in attribute ? attribute.gpuType : undefined) &&
        version.version ===
            (interleaved ? attribute.data.version : attribute.version) &&
        version.data === (interleaved ? attribute.data : undefined) &&
        version.stride === (interleaved ? attribute.data.stride : undefined) &&
        version.offset === (interleaved ? attribute.offset : undefined)
    );
}

export function meshSourceVersionMatches(
    left: MeshSourceVersion,
    geometry: BufferGeometry,
) {
    const morphAttributes: Record<
        string,
        (BufferAttribute | InterleavedBufferAttribute)[] | undefined
    > = geometry.morphAttributes;
    return (
        left.morphTargetsRelative === geometry.morphTargetsRelative &&
        left.attributes.length === Object.keys(geometry.attributes).length &&
        left.morphAttributes.length ===
            Object.keys(geometry.morphAttributes).length &&
        left.attributes.every((attribute) =>
            currentAttribute(attribute, geometry.attributes[attribute.name]),
        ) &&
        left.morphAttributes.every(
            ({ name, attributes }) =>
                attributes.length === morphAttributes[name]?.length &&
                attributes.every((attribute, index) =>
                    currentAttribute(attribute, morphAttributes[name]?.[index]),
                ),
        ) &&
        (left.index === null || geometry.index === null
            ? left.index === geometry.index
            : currentAttribute(left.index, geometry.index))
    );
}
