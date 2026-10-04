import {
    BufferAttribute,
    type BufferGeometry,
    Float32BufferAttribute,
    type InterleavedBufferAttribute,
    type TypedArrayConstructor,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
    Vector3,
} from 'three';

export const WEATHER_SURFACE_GEOMETRY_BRAND =
    'gredice.weather-surface-geometry.v1' as const;

export const WEATHER_SURFACE_GEOMETRY_USER_DATA_KEY =
    'weatherSurfaceGeometry' as const;

export const WEATHER_SURFACE_ATTRIBUTE_NAMES = {
    localPosition: 'aWeatherLocalPosition',
    snowLayer: 'aSnowLayer',
    snowTopDistance: 'aSnowTopDistance',
    surface: 'aWeatherSurface',
} as const;

export const WEATHER_SURFACE_BASE = 0;
export const WEATHER_SURFACE_SKIRT = 1;

type Vector3Tuple = readonly [number, number, number];

export type WeatherSurfaceGeometryMetadata = {
    appendedVertexCount: number;
    boundaryEdgeCount: number;
    brand: typeof WEATHER_SURFACE_GEOMETRY_BRAND;
    includesSnowSkirts: boolean;
    preparedTriangleCount: number;
    sourceBounds: {
        max: Vector3Tuple;
        min: Vector3Tuple;
    };
    sourceTopY: number;
    sourceTriangleCount: number;
    sourceVertexCount: number;
    skirtTriangleCount: number;
};

export type WeatherSurfaceGeometryTriangleStats = {
    avoidedTriangleCount: number;
    baseTriangleCount: number;
    separatePassTriangleCount: number;
    singlePassTriangleCount: number;
    skirtTriangleCount: number;
};

type GeometryAttribute = BufferAttribute | InterleavedBufferAttribute;

type BoundaryEdge = {
    count: number;
    end: number;
    start: number;
};

type SkirtVertex = {
    normal: Vector3Tuple;
    snowLayer: number;
    sourceIndex: number;
};

const baseGeometryCache = new WeakMap<BufferGeometry, BufferGeometry>();
const skirtedGeometryCache = new WeakMap<BufferGeometry, BufferGeometry>();
const up = new Vector3(0, 1, 0);
const vertexA = new Vector3();
const vertexB = new Vector3();
const edgeDirection = new Vector3();
const edgeMidpoint = new Vector3();
const outward = new Vector3();
const centerDirection = new Vector3();

function requireAttribute(
    geometry: BufferGeometry,
    name: string,
): GeometryAttribute {
    const attribute = geometry.getAttribute(name);
    if (!attribute) {
        throw new Error(
            `Unable to prepare weather surface: missing "${name}" attribute.`,
        );
    }
    return attribute;
}

function readIndices(geometry: BufferGeometry, vertexCount: number) {
    const index = geometry.getIndex();
    const indices = index
        ? Array.from({ length: index.count }, (_, offset) => index.getX(offset))
        : Array.from({ length: vertexCount }, (_, offset) => offset);

    if (indices.length % 3 !== 0) {
        throw new Error(
            `Unable to prepare weather surface: index count ${indices.length} does not describe complete triangles.`,
        );
    }

    for (const vertexIndex of indices) {
        if (
            !Number.isInteger(vertexIndex) ||
            vertexIndex < 0 ||
            vertexIndex >= vertexCount
        ) {
            throw new Error(
                `Unable to prepare weather surface: vertex index ${vertexIndex} is outside 0..${vertexCount - 1}.`,
            );
        }
    }

    return indices;
}

function normalizedNumberKey(value: number) {
    return Object.is(value, -0) ? '0' : String(value);
}

/**
 * Snow displacement depends on both source position and normal. Treating those
 * values as the topological identity welds coplanar non-indexed triangles and
 * UV seams, while retaining a skirt where a hard-normal seam can pull apart.
 */
function displacementVertexKey(
    position: GeometryAttribute,
    normal: GeometryAttribute,
    index: number,
) {
    return [
        position.getX(index),
        position.getY(index),
        position.getZ(index),
        normal.getX(index),
        normal.getY(index),
        normal.getZ(index),
    ]
        .map(normalizedNumberKey)
        .join(':');
}

function collectBoundaryEdges(
    indices: readonly number[],
    position: GeometryAttribute,
    normal: GeometryAttribute,
) {
    const vertexKeys = Array.from({ length: position.count }, (_, index) =>
        displacementVertexKey(position, normal, index),
    );
    const edges = new Map<string, BoundaryEdge>();

    const registerEdge = (start: number, end: number) => {
        const startKey = vertexKeys[start];
        const endKey = vertexKeys[end];
        const key =
            startKey < endKey
                ? `${startKey}|${endKey}`
                : `${endKey}|${startKey}`;
        const existing = edges.get(key);
        if (existing) {
            existing.count += 1;
            return;
        }
        edges.set(key, { count: 1, end, start });
    };

    for (let offset = 0; offset < indices.length; offset += 3) {
        const a = indices[offset];
        const b = indices[offset + 1];
        const c = indices[offset + 2];
        registerEdge(a, b);
        registerEdge(b, c);
        registerEdge(c, a);
    }

    return [...edges.values()].filter((edge) => edge.count === 1);
}

function collectSkirtVertices(
    boundaryEdges: readonly BoundaryEdge[],
    position: GeometryAttribute,
    boundsCenter: Vector3,
) {
    const vertices: SkirtVertex[] = [];

    for (const edge of boundaryEdges) {
        vertexA.fromBufferAttribute(position, edge.start);
        vertexB.fromBufferAttribute(position, edge.end);
        edgeDirection.subVectors(vertexB, vertexA);
        if (edgeDirection.lengthSq() < 1e-8) {
            continue;
        }

        outward.crossVectors(edgeDirection, up);
        if (outward.lengthSq() < 1e-8) {
            continue;
        }
        outward.normalize();

        edgeMidpoint.addVectors(vertexA, vertexB).multiplyScalar(0.5);
        centerDirection.subVectors(edgeMidpoint, boundsCenter);
        if (centerDirection.dot(outward) < 0) {
            outward.negate();
        }
        const normal = Object.freeze([
            outward.x,
            outward.y,
            outward.z,
        ]) as Vector3Tuple;

        vertices.push(
            { normal, snowLayer: 1, sourceIndex: edge.start },
            { normal, snowLayer: 1, sourceIndex: edge.end },
            { normal, snowLayer: 0, sourceIndex: edge.end },
            { normal, snowLayer: 0, sourceIndex: edge.start },
        );
    }

    return vertices;
}

function expandAttribute(
    attribute: GeometryAttribute,
    skirtVertices: readonly SkirtVertex[],
    overrides?: (vertex: SkirtVertex, component: number) => number,
) {
    const flattened = attribute.clone();
    const AttributeArray = flattened.array.constructor as TypedArrayConstructor;
    const expandedArray = new AttributeArray(
        (flattened.count + skirtVertices.length) * flattened.itemSize,
    );
    expandedArray.set(flattened.array);

    skirtVertices.forEach((vertex, skirtIndex) => {
        const targetOffset =
            (flattened.count + skirtIndex) * flattened.itemSize;
        const sourceOffset = vertex.sourceIndex * flattened.itemSize;
        for (let component = 0; component < flattened.itemSize; component++) {
            expandedArray[targetOffset + component] = overrides
                ? overrides(vertex, component)
                : flattened.array[sourceOffset + component];
        }
    });

    const expanded = new BufferAttribute(
        expandedArray,
        flattened.itemSize,
        flattened.normalized,
    );
    expanded.name = flattened.name;
    expanded.gpuType = flattened.gpuType;
    expanded.setUsage(flattened.usage);
    return expanded;
}

function createWeatherAttributes(
    position: GeometryAttribute,
    skirtVertices: readonly SkirtVertex[],
    sourceTopY: number,
) {
    const vertexCount = position.count + skirtVertices.length;
    const localPositions = new Float32Array(vertexCount * 3);
    const snowLayers = new Float32Array(vertexCount);
    const snowTopDistances = new Float32Array(vertexCount);
    const surfaces = new Float32Array(vertexCount);

    const writeVertex = (
        targetIndex: number,
        sourceIndex: number,
        snowLayer: number,
        surface: number,
    ) => {
        const x = position.getX(sourceIndex);
        const y = position.getY(sourceIndex);
        const z = position.getZ(sourceIndex);
        const positionOffset = targetIndex * 3;
        localPositions[positionOffset] = x;
        localPositions[positionOffset + 1] = y;
        localPositions[positionOffset + 2] = z;
        snowLayers[targetIndex] = snowLayer;
        snowTopDistances[targetIndex] = Math.max(sourceTopY - y, 0);
        surfaces[targetIndex] = surface;
    };

    for (let index = 0; index < position.count; index++) {
        writeVertex(index, index, 1, WEATHER_SURFACE_BASE);
    }
    skirtVertices.forEach((vertex, skirtIndex) => {
        writeVertex(
            position.count + skirtIndex,
            vertex.sourceIndex,
            vertex.snowLayer,
            WEATHER_SURFACE_SKIRT,
        );
    });

    return {
        localPosition: new Float32BufferAttribute(localPositions, 3),
        snowLayer: new Float32BufferAttribute(snowLayers, 1),
        snowTopDistance: new Float32BufferAttribute(snowTopDistances, 1),
        surface: new Float32BufferAttribute(surfaces, 1),
    };
}

function createMetadata({
    boundaryEdgeCount,
    boundsMax,
    boundsMin,
    includesSnowSkirts,
    preparedTriangleCount,
    sourceTriangleCount,
    sourceVertexCount,
}: {
    boundaryEdgeCount: number;
    boundsMax: Vector3Tuple;
    boundsMin: Vector3Tuple;
    includesSnowSkirts: boolean;
    preparedTriangleCount: number;
    sourceTriangleCount: number;
    sourceVertexCount: number;
}): WeatherSurfaceGeometryMetadata {
    const skirtTriangleCount = boundaryEdgeCount * 2;
    return Object.freeze({
        appendedVertexCount: boundaryEdgeCount * 4,
        boundaryEdgeCount,
        brand: WEATHER_SURFACE_GEOMETRY_BRAND,
        includesSnowSkirts,
        preparedTriangleCount,
        sourceBounds: Object.freeze({
            max: Object.freeze([...boundsMax]) as Vector3Tuple,
            min: Object.freeze([...boundsMin]) as Vector3Tuple,
        }),
        sourceTopY: boundsMax[1],
        sourceTriangleCount,
        sourceVertexCount,
        skirtTriangleCount,
    });
}

export function countGeometryTriangles(geometry: BufferGeometry) {
    const index = geometry.getIndex();
    const elementCount =
        index?.count ?? geometry.getAttribute('position')?.count;
    if (elementCount === undefined) {
        throw new Error(
            'Unable to count geometry triangles: missing "position" attribute.',
        );
    }
    if (elementCount % 3 !== 0) {
        throw new Error(
            `Unable to count geometry triangles: element count ${elementCount} does not describe complete triangles.`,
        );
    }
    return elementCount / 3;
}

export function getWeatherSurfaceGeometryMetadata(
    geometry: BufferGeometry,
): WeatherSurfaceGeometryMetadata | undefined {
    const metadata = Reflect.get(
        geometry.userData,
        WEATHER_SURFACE_GEOMETRY_USER_DATA_KEY,
    );
    if (
        typeof metadata !== 'object' ||
        metadata === null ||
        Reflect.get(metadata, 'brand') !== WEATHER_SURFACE_GEOMETRY_BRAND
    ) {
        return undefined;
    }
    return metadata as WeatherSurfaceGeometryMetadata;
}

export function isWeatherSurfaceGeometry(geometry: BufferGeometry) {
    return getWeatherSurfaceGeometryMetadata(geometry) !== undefined;
}

export function getWeatherSurfaceGeometryTriangleStats(
    geometry: BufferGeometry,
): WeatherSurfaceGeometryTriangleStats {
    const metadata = getWeatherSurfaceGeometryMetadata(geometry);
    if (!metadata) {
        throw new Error(
            'Unable to inspect weather surface triangles: geometry is not prepared.',
        );
    }
    const singlePassTriangleCount = countGeometryTriangles(geometry);
    if (singlePassTriangleCount !== metadata.preparedTriangleCount) {
        throw new Error(
            'Unable to inspect weather surface triangles: topology changed after preparation.',
        );
    }

    return {
        avoidedTriangleCount: metadata.sourceTriangleCount,
        baseTriangleCount: metadata.sourceTriangleCount,
        separatePassTriangleCount:
            metadata.sourceTriangleCount + singlePassTriangleCount,
        singlePassTriangleCount,
        skirtTriangleCount: metadata.skirtTriangleCount,
    };
}

/**
 * Clones source topology into a geometry that can render base, rain, and snow
 * in one material pass. Original triangles stay at the front of the index
 * stream; only degenerate boundary skirts are appended for snow displacement.
 *
 * The returned geometry is cached by source identity. It owns every attribute
 * and index buffer it exposes and never mutates or disposes the source.
 */
export function createWeatherSurfaceGeometry(
    source: BufferGeometry,
    {
        includeSnowSkirts = true,
    }: {
        includeSnowSkirts?: boolean;
    } = {},
): BufferGeometry {
    const sourceMetadata = getWeatherSurfaceGeometryMetadata(source);
    if (sourceMetadata?.includesSnowSkirts === includeSnowSkirts) {
        return source;
    }

    const geometryCache = includeSnowSkirts
        ? skirtedGeometryCache
        : baseGeometryCache;
    const cached = geometryCache.get(source);
    if (cached) {
        return cached;
    }

    const result = source.clone();
    if (!result.getAttribute('normal')) {
        result.computeVertexNormals();
    }
    result.computeBoundingBox();
    const bounds = result.boundingBox;
    if (!bounds) {
        throw new Error(
            'Unable to prepare weather surface: geometry has no bounds.',
        );
    }

    const position = requireAttribute(result, 'position');
    const normal = requireAttribute(result, 'normal');
    const sourceVertexCount = position.count;
    const indices = readIndices(result, sourceVertexCount);
    const sourceTriangleCount = indices.length / 3;
    const boundaryEdges = includeSnowSkirts
        ? collectBoundaryEdges(indices, position, normal)
        : [];
    const boundsCenter = bounds.getCenter(new Vector3());
    const skirtVertices = collectSkirtVertices(
        boundaryEdges,
        position,
        boundsCenter,
    );
    const boundaryEdgeCount = skirtVertices.length / 4;

    for (const [name, attribute] of Object.entries(result.attributes)) {
        result.setAttribute(
            name,
            expandAttribute(
                attribute,
                skirtVertices,
                name === 'normal'
                    ? (vertex, component) => vertex.normal[component] ?? 0
                    : undefined,
            ),
        );
    }

    for (const [name, attributes] of Object.entries(result.morphAttributes)) {
        Reflect.set(
            result.morphAttributes,
            name,
            attributes.map((attribute) =>
                expandAttribute(attribute, skirtVertices),
            ),
        );
    }

    const weatherAttributes = createWeatherAttributes(
        position,
        skirtVertices,
        bounds.max.y,
    );
    result.setAttribute(
        WEATHER_SURFACE_ATTRIBUTE_NAMES.localPosition,
        weatherAttributes.localPosition,
    );
    result.setAttribute(
        WEATHER_SURFACE_ATTRIBUTE_NAMES.snowLayer,
        weatherAttributes.snowLayer,
    );
    result.setAttribute(
        WEATHER_SURFACE_ATTRIBUTE_NAMES.snowTopDistance,
        weatherAttributes.snowTopDistance,
    );
    result.setAttribute(
        WEATHER_SURFACE_ATTRIBUTE_NAMES.surface,
        weatherAttributes.surface,
    );

    const firstSkirtVertex = sourceVertexCount;
    for (
        let skirtOffset = 0;
        skirtOffset < skirtVertices.length;
        skirtOffset += 4
    ) {
        const topA = firstSkirtVertex + skirtOffset;
        const topB = topA + 1;
        const baseB = topA + 2;
        const baseA = topA + 3;
        indices.push(topA, topB, baseB, topA, baseB, baseA);
    }

    const IndexAttribute =
        sourceVertexCount + skirtVertices.length > 65_535
            ? Uint32BufferAttribute
            : Uint16BufferAttribute;
    result.setIndex(new IndexAttribute(indices, 1));
    result.setDrawRange(0, indices.length);
    result.computeBoundingBox();
    result.computeBoundingSphere();

    const preparedTriangleCount = indices.length / 3;
    const metadata = createMetadata({
        boundaryEdgeCount,
        boundsMax: [bounds.max.x, bounds.max.y, bounds.max.z],
        boundsMin: [bounds.min.x, bounds.min.y, bounds.min.z],
        includesSnowSkirts: includeSnowSkirts,
        preparedTriangleCount,
        sourceTriangleCount,
        sourceVertexCount,
    });
    result.userData = {
        ...result.userData,
        [WEATHER_SURFACE_GEOMETRY_USER_DATA_KEY]: metadata,
    };

    geometryCache.set(source, result);
    return result;
}
