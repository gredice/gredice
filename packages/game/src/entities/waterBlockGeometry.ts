import {
    BufferGeometry,
    Float32BufferAttribute,
    Uint16BufferAttribute,
    type Vector4,
} from 'three';

const waterBlockHalfSize = 0.5;
export const defaultWaterBlockVisualHeight = 0.4;
export const waterBlockBottomOverlap = 0.06;
const segmentMergeEpsilon = 1e-6;

type WaterFoamEdge = 'x' | 'y' | 'z' | 'w';

type WaterFace = {
    normal: [number, number, number];
    vertices: [
        [number, number, number],
        [number, number, number],
        [number, number, number],
        [number, number, number],
    ];
};

type WaterBlockGeometryOptions = {
    height?: number;
    includeSides?: boolean;
    includeTop?: boolean;
};

type WaterSideInstance = {
    position: [number, number, number];
    waterHeight?: number;
};

type WaterSideSegment = {
    axis: 'x' | 'z';
    line: number;
    normal: [number, number, number];
    start: number;
    end: number;
    yMax: number;
    yMin: number;
};

export function getWaterBlockYOffset(height = defaultWaterBlockVisualHeight) {
    return height / 2 - waterBlockBottomOverlap;
}

function waterBlockMinY(height: number) {
    return -height / 2;
}

function waterBlockMaxY(height: number) {
    return height / 2;
}

function createTopFace(height: number): WaterFace {
    const y = waterBlockMaxY(height);

    return {
        normal: [0, 1, 0],
        vertices: [
            [-waterBlockHalfSize, y, -waterBlockHalfSize],
            [-waterBlockHalfSize, y, waterBlockHalfSize],
            [waterBlockHalfSize, y, waterBlockHalfSize],
            [waterBlockHalfSize, y, -waterBlockHalfSize],
        ],
    };
}

function createWaterSideFaces(height: number) {
    const yMin = waterBlockMinY(height);
    const yMax = waterBlockMaxY(height);

    return [
        {
            edge: 'x',
            normal: [-1, 0, 0],
            vertices: [
                [-waterBlockHalfSize, yMin, waterBlockHalfSize],
                [-waterBlockHalfSize, yMax, waterBlockHalfSize],
                [-waterBlockHalfSize, yMax, -waterBlockHalfSize],
                [-waterBlockHalfSize, yMin, -waterBlockHalfSize],
            ],
        },
        {
            edge: 'y',
            normal: [1, 0, 0],
            vertices: [
                [waterBlockHalfSize, yMin, -waterBlockHalfSize],
                [waterBlockHalfSize, yMax, -waterBlockHalfSize],
                [waterBlockHalfSize, yMax, waterBlockHalfSize],
                [waterBlockHalfSize, yMin, waterBlockHalfSize],
            ],
        },
        {
            edge: 'z',
            normal: [0, 0, -1],
            vertices: [
                [waterBlockHalfSize, yMin, -waterBlockHalfSize],
                [waterBlockHalfSize, yMax, -waterBlockHalfSize],
                [-waterBlockHalfSize, yMax, -waterBlockHalfSize],
                [-waterBlockHalfSize, yMin, -waterBlockHalfSize],
            ],
        },
        {
            edge: 'w',
            normal: [0, 0, 1],
            vertices: [
                [-waterBlockHalfSize, yMin, waterBlockHalfSize],
                [-waterBlockHalfSize, yMax, waterBlockHalfSize],
                [waterBlockHalfSize, yMax, waterBlockHalfSize],
                [waterBlockHalfSize, yMin, waterBlockHalfSize],
            ],
        },
    ] satisfies Array<WaterFace & { edge: WaterFoamEdge }>;
}

function pushFace({
    face,
    indices,
    normals,
    positions,
}: {
    face: WaterFace;
    indices: number[];
    normals: number[];
    positions: number[];
}) {
    const startIndex = positions.length / 3;

    for (const vertex of face.vertices) {
        positions.push(...vertex);
        normals.push(...face.normal);
    }

    indices.push(
        startIndex,
        startIndex + 1,
        startIndex + 2,
        startIndex,
        startIndex + 2,
        startIndex + 3,
    );
}

function createGeometryFromFaces(faces: WaterFace[]) {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (const face of faces) {
        pushFace({ face, positions, normals, indices });
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setIndex(new Uint16BufferAttribute(indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}

export function createWaterBlockGeometry(
    foamEdges: Vector4,
    {
        height = defaultWaterBlockVisualHeight,
        includeSides = true,
        includeTop = true,
    }: WaterBlockGeometryOptions = {},
) {
    const faces = includeTop ? [createTopFace(height)] : [];

    if (includeSides) {
        for (const face of createWaterSideFaces(height)) {
            if (foamEdges[face.edge] > 0.5) {
                faces.push(face);
            }
        }
    }

    return createGeometryFromFaces(faces);
}

function positionKey(x: number, y: number, z: number) {
    return `${x}|${y}|${z}`;
}

function segmentGroupKey(segment: WaterSideSegment) {
    return [
        segment.axis,
        segment.line,
        segment.normal.join(','),
        segment.yMin,
        segment.yMax,
    ].join('|');
}

function verticalSegmentGroupKey(segment: WaterSideSegment) {
    return [
        segment.axis,
        segment.line,
        segment.normal.join(','),
        segment.start,
        segment.end,
    ].join('|');
}

function mergeVerticalSideSegments(segments: WaterSideSegment[]) {
    const segmentGroups = new Map<string, WaterSideSegment[]>();

    for (const segment of segments) {
        const key = verticalSegmentGroupKey(segment);
        const group = segmentGroups.get(key);

        if (group) {
            group.push(segment);
        } else {
            segmentGroups.set(key, [segment]);
        }
    }

    const mergedSegments: WaterSideSegment[] = [];

    for (const group of segmentGroups.values()) {
        const sortedGroup = [...group].sort(
            (left, right) => left.yMin - right.yMin,
        );
        const [firstSegment] = sortedGroup;
        let currentSegment: WaterSideSegment | null = firstSegment
            ? { ...firstSegment }
            : null;

        for (const segment of sortedGroup.slice(1)) {
            if (
                currentSegment &&
                segment.yMin <= currentSegment.yMax + segmentMergeEpsilon
            ) {
                currentSegment.yMax = Math.max(
                    currentSegment.yMax,
                    segment.yMax,
                );
                continue;
            }

            if (currentSegment) {
                mergedSegments.push(currentSegment);
            }
            currentSegment = { ...segment };
        }

        if (currentSegment) {
            mergedSegments.push(currentSegment);
        }
    }

    return mergedSegments;
}

function mergeHorizontalSideSegments(segments: WaterSideSegment[]) {
    const segmentGroups = new Map<string, WaterSideSegment[]>();

    for (const segment of segments) {
        const key = segmentGroupKey(segment);
        const group = segmentGroups.get(key);

        if (group) {
            group.push(segment);
        } else {
            segmentGroups.set(key, [segment]);
        }
    }

    const mergedSegments: WaterSideSegment[] = [];

    for (const group of segmentGroups.values()) {
        const sortedGroup = [...group].sort(
            (left, right) => left.start - right.start,
        );
        const [firstSegment] = sortedGroup;
        let currentSegment: WaterSideSegment | null = firstSegment
            ? { ...firstSegment }
            : null;

        for (const segment of sortedGroup.slice(1)) {
            if (
                currentSegment &&
                segment.start <= currentSegment.end + segmentMergeEpsilon
            ) {
                currentSegment.end = Math.max(currentSegment.end, segment.end);
                continue;
            }

            if (currentSegment) {
                mergedSegments.push(currentSegment);
            }
            currentSegment = { ...segment };
        }

        if (currentSegment) {
            mergedSegments.push(currentSegment);
        }
    }

    return mergedSegments;
}

function mergeSideSegments(segments: WaterSideSegment[]) {
    return mergeHorizontalSideSegments(mergeVerticalSideSegments(segments));
}

function waterSideSegmentToFace(segment: WaterSideSegment): WaterFace {
    const { end, line, normal, start, yMax, yMin } = segment;

    if (segment.axis === 'z') {
        return {
            normal,
            vertices:
                normal[2] < 0
                    ? [
                          [end, yMin, line],
                          [end, yMax, line],
                          [start, yMax, line],
                          [start, yMin, line],
                      ]
                    : [
                          [start, yMin, line],
                          [start, yMax, line],
                          [end, yMax, line],
                          [end, yMin, line],
                      ],
        };
    }

    return {
        normal,
        vertices:
            normal[0] < 0
                ? [
                      [line, yMin, end],
                      [line, yMax, end],
                      [line, yMax, start],
                      [line, yMin, start],
                  ]
                : [
                      [line, yMin, start],
                      [line, yMax, start],
                      [line, yMax, end],
                      [line, yMin, end],
                  ],
    };
}

export function createMergedWaterSideGeometry(instances: WaterSideInstance[]) {
    const waterPositions = new Set(
        instances.map((instance) =>
            positionKey(
                instance.position[0],
                instance.position[1],
                instance.position[2],
            ),
        ),
    );
    const sideSegments: WaterSideSegment[] = [];

    for (const instance of instances) {
        const [x, y, z] = instance.position;
        const height = instance.waterHeight ?? defaultWaterBlockVisualHeight;
        const yMin = y + waterBlockMinY(height);
        const yMax = y + waterBlockMaxY(height);

        if (!waterPositions.has(positionKey(x - 1, y, z))) {
            sideSegments.push({
                axis: 'x',
                line: x - waterBlockHalfSize,
                normal: [-1, 0, 0],
                start: z - waterBlockHalfSize,
                end: z + waterBlockHalfSize,
                yMin,
                yMax,
            });
        }

        if (!waterPositions.has(positionKey(x + 1, y, z))) {
            sideSegments.push({
                axis: 'x',
                line: x + waterBlockHalfSize,
                normal: [1, 0, 0],
                start: z - waterBlockHalfSize,
                end: z + waterBlockHalfSize,
                yMin,
                yMax,
            });
        }

        if (!waterPositions.has(positionKey(x, y, z - 1))) {
            sideSegments.push({
                axis: 'z',
                line: z - waterBlockHalfSize,
                normal: [0, 0, -1],
                start: x - waterBlockHalfSize,
                end: x + waterBlockHalfSize,
                yMin,
                yMax,
            });
        }

        if (!waterPositions.has(positionKey(x, y, z + 1))) {
            sideSegments.push({
                axis: 'z',
                line: z + waterBlockHalfSize,
                normal: [0, 0, 1],
                start: x - waterBlockHalfSize,
                end: x + waterBlockHalfSize,
                yMin,
                yMax,
            });
        }
    }

    return createGeometryFromFaces(
        mergeSideSegments(sideSegments).map(waterSideSegmentToFace),
    );
}
