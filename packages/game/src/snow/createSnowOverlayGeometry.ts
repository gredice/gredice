import {
    BufferAttribute,
    BufferGeometry,
    Float32BufferAttribute,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
    Vector3,
} from 'three';

type EdgeInfo = {
    start: number;
    end: number;
    count: number;
};

const cache = new WeakMap<BufferGeometry, BufferGeometry>();
const upVector = new Vector3(0, 1, 0);
const scratchA = new Vector3();
const scratchB = new Vector3();
const scratchEdge = new Vector3();
const scratchOut = new Vector3();
const scratchMid = new Vector3();
const scratchCenter = new Vector3();
const scratchDir = new Vector3();

function getAttributeClone<T extends BufferAttribute>(geometry: BufferGeometry, name: string) {
    const attr = geometry.getAttribute(name) as T | undefined;
    if (!attr) {
        throw new Error(`Geometry is missing required attribute "${name}"`);
    }
    return attr;
}

export function createSnowOverlayGeometry(source: BufferGeometry): BufferGeometry {
    const cached = cache.get(source);
    if (cached) {
        return cached;
    }

    const workingGeometry = source.clone();
    if (!workingGeometry.getAttribute('normal')) {
        workingGeometry.computeVertexNormals();
    }
    workingGeometry.computeBoundingBox();
    const boundingBox = workingGeometry.boundingBox;
    if (!boundingBox) {
        throw new Error('Unable to resolve geometry bounding box for snow overlay.');
    }

    const positionAttr = getAttributeClone<BufferAttribute>(workingGeometry, 'position');
    const normalAttr = getAttributeClone<BufferAttribute>(workingGeometry, 'normal');
    const uvAttr = workingGeometry.getAttribute('uv') as BufferAttribute | undefined;

    const vertexCount = positionAttr.count;
    const positions: number[] = Array.from(positionAttr.array);
    const normals: number[] = Array.from(normalAttr.array);
    const snowLayers: number[] = new Array(vertexCount).fill(1);
    const uvs: number[] | undefined = uvAttr ? Array.from(uvAttr.array) : undefined;

    const indexAttr = workingGeometry.getIndex();
    const indices: number[] = indexAttr
        ? Array.from(indexAttr.array as ArrayLike<number>)
        : Array.from({ length: vertexCount }, (_, index) => index);

    const edges = new Map<string, EdgeInfo>();
    const registerEdge = (start: number, end: number) => {
        const key = start < end ? `${start}_${end}` : `${end}_${start}`;
        const existing = edges.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            edges.set(key, { start, end, count: 1 });
        }
    };

    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i];
        const b = indices[i + 1];
        const c = indices[i + 2];
        registerEdge(a, b);
        registerEdge(b, c);
        registerEdge(c, a);
    }

    boundingBox.getCenter(scratchCenter);

    let nextVertexIndex = vertexCount;
    const pushVertex = (position: Vector3, normal: Vector3, layer: number) => {
        positions.push(position.x, position.y, position.z);
        normals.push(normal.x, normal.y, normal.z);
        snowLayers.push(layer);
        if (uvs) {
            uvs.push(0, 0);
        }
        return nextVertexIndex++;
    };

    edges.forEach((edge) => {
        if (edge.count !== 1) {
            return;
        }

        const { start, end } = edge;
        const vertexA = scratchA.fromBufferAttribute(positionAttr, start);
        const vertexB = scratchB.fromBufferAttribute(positionAttr, end);

        scratchEdge.subVectors(vertexB, vertexA);
        if (scratchEdge.lengthSq() < 1e-8) {
            return;
        }

        scratchOut.crossVectors(scratchEdge, upVector).normalize();
        if (scratchOut.lengthSq() < 1e-8) {
            return;
        }

        scratchMid.addVectors(vertexA, vertexB).multiplyScalar(0.5);
        scratchDir.subVectors(scratchMid, scratchCenter);
        if (scratchDir.dot(scratchOut) < 0) {
            scratchOut.negate();
        }

        const topA = pushVertex(vertexA, scratchOut, 1);
        const topB = pushVertex(vertexB, scratchOut, 1);
        const baseB = pushVertex(vertexB, scratchOut, 0);
        const baseA = pushVertex(vertexA, scratchOut, 0);

        indices.push(topA, topB, baseB);
        indices.push(topA, baseB, baseA);
    });

    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(positions, 3));
    result.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    result.setAttribute('aSnowLayer', new Float32BufferAttribute(snowLayers, 1));
    if (uvs) {
        result.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    }

    const IndexAttributeCtor =
        positions.length / 3 > 65535 ? Uint32BufferAttribute : Uint16BufferAttribute;
    result.setIndex(new IndexAttributeCtor(indices, 1));
    result.computeBoundingBox();
    result.computeBoundingSphere();

    cache.set(source, result);
    return result;
}
