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

type WaterSideInstanceRange = {
    max: number;
    min: number;
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

function stackPositionKey(x: number, z: number) {
    return `${x}|${z}`;
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

function getWaterSideInstanceHeight(instance: WaterSideInstance) {
    return instance.waterHeight ?? defaultWaterBlockVisualHeight;
}

function getWaterSideInstanceRange(instance: WaterSideInstance) {
    const [, y] = instance.position;
    const halfHeight = getWaterSideInstanceHeight(instance) / 2;

    return {
        min: y - halfHeight,
        max: y + halfHeight,
    } satisfies WaterSideInstanceRange;
}

function groupWaterSideInstancesByStackPosition(
    instances: WaterSideInstance[],
) {
    const groups = new Map<string, WaterSideInstance[]>();

    for (const instance of instances) {
        const [x, , z] = instance.position;
        const key = stackPositionKey(x, z);
        const group = groups.get(key);

        if (group) {
            group.push(instance);
        } else {
            groups.set(key, [instance]);
        }
    }

    return groups;
}

function clipWaterSideRange(
    range: WaterSideInstanceRange,
    clipRange: WaterSideInstanceRange,
) {
    const clipMin = Math.max(range.min, clipRange.min);
    const clipMax = Math.min(range.max, clipRange.max);

    if (clipMax - clipMin <= segmentMergeEpsilon) {
        return [range];
    }

    const remainingRanges: WaterSideInstanceRange[] = [];

    if (clipMin - range.min > segmentMergeEpsilon) {
        remainingRanges.push({
            min: range.min,
            max: clipMin,
        });
    }

    if (range.max - clipMax > segmentMergeEpsilon) {
        remainingRanges.push({
            min: clipMax,
            max: range.max,
        });
    }

    return remainingRanges;
}

function getVisibleWaterSideRanges({
    range,
    stackGroups,
    x,
    z,
}: {
    range: WaterSideInstanceRange;
    stackGroups: Map<string, WaterSideInstance[]>;
    x: number;
    z: number;
}) {
    const neighborRanges =
        stackGroups
            .get(stackPositionKey(x, z))
            ?.map(getWaterSideInstanceRange)
            .sort((left, right) => left.min - right.min) ?? [];
    let visibleRanges = [range];

    for (const neighborRange of neighborRanges) {
        visibleRanges = visibleRanges.flatMap((visibleRange) =>
            clipWaterSideRange(visibleRange, neighborRange),
        );

        if (visibleRanges.length === 0) {
            break;
        }
    }

    return visibleRanges;
}

function pushVisibleWaterSideSegments({
    axis,
    end,
    line,
    normal,
    range,
    sideSegments,
    stackGroups,
    start,
    x,
    z,
}: {
    axis: 'x' | 'z';
    end: number;
    line: number;
    normal: [number, number, number];
    range: WaterSideInstanceRange;
    sideSegments: WaterSideSegment[];
    stackGroups: Map<string, WaterSideInstance[]>;
    start: number;
    x: number;
    z: number;
}) {
    for (const visibleRange of getVisibleWaterSideRanges({
        range,
        stackGroups,
        x,
        z,
    })) {
        sideSegments.push({
            axis,
            line,
            normal,
            start,
            end,
            yMin: visibleRange.min,
            yMax: visibleRange.max,
        });
    }
}

export function createMergedWaterSideGeometry(instances: WaterSideInstance[]) {
    const stackGroups = groupWaterSideInstancesByStackPosition(instances);
    const sideSegments: WaterSideSegment[] = [];

    for (const instance of instances) {
        const [x, y, z] = instance.position;
        const height = getWaterSideInstanceHeight(instance);
        const yMin = y + waterBlockMinY(height);
        const yMax = y + waterBlockMaxY(height);
        const range = { min: yMin, max: yMax };

        pushVisibleWaterSideSegments({
            axis: 'x',
            line: x - waterBlockHalfSize,
            normal: [-1, 0, 0],
            start: z - waterBlockHalfSize,
            end: z + waterBlockHalfSize,
            range,
            sideSegments,
            stackGroups,
            x: x - 1,
            z,
        });

        pushVisibleWaterSideSegments({
            axis: 'x',
            line: x + waterBlockHalfSize,
            normal: [1, 0, 0],
            start: z - waterBlockHalfSize,
            end: z + waterBlockHalfSize,
            range,
            sideSegments,
            stackGroups,
            x: x + 1,
            z,
        });

        pushVisibleWaterSideSegments({
            axis: 'z',
            line: z - waterBlockHalfSize,
            normal: [0, 0, -1],
            start: x - waterBlockHalfSize,
            end: x + waterBlockHalfSize,
            range,
            sideSegments,
            stackGroups,
            x,
            z: z - 1,
        });

        pushVisibleWaterSideSegments({
            axis: 'z',
            line: z + waterBlockHalfSize,
            normal: [0, 0, 1],
            start: x - waterBlockHalfSize,
            end: x + waterBlockHalfSize,
            range,
            sideSegments,
            stackGroups,
            x,
            z: z + 1,
        });
    }

    return createGeometryFromFaces(
        mergeSideSegments(sideSegments).map(waterSideSegmentToFace),
    );
}
