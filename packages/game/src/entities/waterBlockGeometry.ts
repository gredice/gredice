import {
    BufferGeometry,
    Float32BufferAttribute,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
    type Vector4,
} from 'three';
import type { WaterBlockDepthSamples } from './waterBlockDepth';
import {
    createWaterRimCornerColumnQuads,
    createWaterRimTopQuads,
    type WaterRimFlags,
    type WaterRimQuad,
    type WaterRimSides,
    waterRimConvexCorners,
    waterRimCornersFromFlags,
    waterRimQuadTriangles,
    waterRimRadius,
    waterRimSidesFromFlags,
    waterRimSideTrims,
} from './waterBlockRim';
import {
    type WaterfallFloorProfile,
    type WaterfallFloors,
    waterfallCornerFloor,
    waterfallFloorSpans,
} from './waterfall/waterfallFloorProfile';

const waterBlockHalfSize = 0.5;
export const defaultWaterBlockVisualHeight = 0.4;
export const waterBlockBottomOverlap = 0.06;
const segmentMergeEpsilon = 1e-6;

type WaterFoamEdge = 'x' | 'y' | 'z' | 'w';

type Vec3 = [number, number, number];

/** One value for each corner of a face, in vertex order. */
type WaterFaceVertexValues = [number, number, number, number];

type WaterFace = {
    depth?: number;
    depths?: WaterBlockDepthSamples;
    /** Height the water at each corner falls to (`waterfall/`). */
    fallFloors?: WaterFaceVertexValues;
    normal: Vec3;
    shoreDepths?: WaterBlockDepthSamples;
    surfaceY?: number;
    /** Per-vertex normals of a curved face; `normal` otherwise. */
    vertexNormals?: [Vec3, Vec3, Vec3, Vec3];
    vertices: [Vec3, Vec3, Vec3, Vec3];
};

type WaterBlockGeometryOptions = {
    height?: number;
    includeSides?: boolean;
    includeTop?: boolean;
    /** Inner corners the neighbours' rounded lips turn inside this tile. */
    rimCorners?: WaterRimFlags;
    /** Exposed sides that round over from the top (1) or stay square (0). */
    rimEdges?: WaterRimFlags;
};

type WaterSideInstance = {
    depth?: number;
    depthSamples?: WaterBlockDepthSamples;
    /**
     * Where the water of each side falls to along it, in foam edge order
     * (`waterfall/waterfallPlacements.ts`); level at the surface for a side
     * with no fall.
     */
    fallFloors?: WaterfallFloors;
    position: [number, number, number];
    /** Exposed sides of this block, in foam edge order. */
    rimEdges?: WaterRimFlags;
    shoreDepthSamples?: WaterBlockDepthSamples;
    surfaceY?: number;
    waterHeight?: number;
};

type WaterSideInstanceRange = {
    max: number;
    min: number;
};

type WaterSideSegment = {
    axis: 'x' | 'z';
    depth: number;
    depthEnd: number;
    depthStart: number;
    /** Floor of the fall at the segment's start and end. */
    fallFloors: readonly [number, number] | null;
    hasDepthMap: boolean;
    hasShoreDepthMap: boolean;
    line: number;
    normal: [number, number, number];
    shoreDepthEnd: number;
    shoreDepthStart: number;
    start: number;
    end: number;
    surfaceY: number;
    yMax: number;
    yMin: number;
};

export function getWaterBlockYOffset(height = defaultWaterBlockVisualHeight) {
    return height / 2 - waterBlockBottomOverlap;
}

function offsetFaceVertices(
    [a, b, c, d]: WaterFace['vertices'],
    [ox, oy, oz]: Vec3,
): WaterFace['vertices'] {
    const move = ([vx, vy, vz]: Vec3): Vec3 => [vx + ox, vy + oy, vz + oz];
    return [move(a), move(b), move(c), move(d)];
}

function rimQuadToFace(quad: WaterRimQuad): WaterFace {
    const [a, b, c, d] = quad;
    return {
        normal: a.normal,
        vertexNormals: [a.normal, b.normal, c.normal, d.normal],
        vertices: [a.position, b.position, c.position, d.position],
    };
}

function waterBlockMinY(height: number) {
    return -height / 2;
}

function waterBlockMaxY(height: number) {
    return height / 2;
}

/**
 * The walls of a single block. An exposed side stops one rim radius below
 * the top, where the rounded lip takes over, and one radius short of a
 * rounded corner.
 */
function createWaterSideFaces(
    height: number,
    sides: WaterRimSides,
    includeTop: boolean,
) {
    const yMin = waterBlockMinY(height);
    const top = waterBlockMaxY(height);
    const h = waterBlockHalfSize;
    const wallTop = (side: number) =>
        sides[side] && includeTop ? top - waterRimRadius : top;
    const along = (side: number) => {
        const trims = waterRimSideTrims(side, sides);
        return {
            end: h - (trims.end ? waterRimRadius : 0),
            start: -h + (trims.start ? waterRimRadius : 0),
        };
    };
    const negX = along(0);
    const posX = along(1);
    const negZ = along(2);
    const posZ = along(3);

    return [
        {
            edge: 'x',
            normal: [-1, 0, 0],
            vertices: [
                [-h, yMin, negX.end],
                [-h, wallTop(0), negX.end],
                [-h, wallTop(0), negX.start],
                [-h, yMin, negX.start],
            ],
        },
        {
            edge: 'y',
            normal: [1, 0, 0],
            vertices: [
                [h, yMin, posX.start],
                [h, wallTop(1), posX.start],
                [h, wallTop(1), posX.end],
                [h, yMin, posX.end],
            ],
        },
        {
            edge: 'z',
            normal: [0, 0, -1],
            vertices: [
                [negZ.end, yMin, -h],
                [negZ.end, wallTop(2), -h],
                [negZ.start, wallTop(2), -h],
                [negZ.start, yMin, -h],
            ],
        },
        {
            edge: 'w',
            normal: [0, 0, 1],
            vertices: [
                [posZ.start, yMin, h],
                [posZ.start, wallTop(3), h],
                [posZ.end, wallTop(3), h],
                [posZ.end, yMin, h],
            ],
        },
    ] satisfies Array<WaterFace & { edge: WaterFoamEdge }>;
}

function pushFace({
    face,
    indices,
    normals,
    positions,
    waterDepths,
    waterFallFloors,
    waterShoreDepths,
    waterSurfaceYs,
}: {
    face: WaterFace;
    indices: number[];
    normals: number[];
    positions: number[];
    waterDepths?: number[];
    waterFallFloors?: number[];
    waterShoreDepths?: number[];
    waterSurfaceYs?: number[];
}) {
    const startIndex = positions.length / 3;

    const vertexNormals = face.vertexNormals ?? [
        face.normal,
        face.normal,
        face.normal,
        face.normal,
    ];

    for (const [vertexIndex, vertex] of face.vertices.entries()) {
        positions.push(...vertex);
        normals.push(...(vertexNormals[vertexIndex] ?? face.normal));
        waterDepths?.push(face.depths?.[vertexIndex] ?? face.depth ?? 0);
        waterShoreDepths?.push(face.shoreDepths?.[vertexIndex] ?? 0);
        waterSurfaceYs?.push(face.surfaceY ?? vertex[1]);
        // A face with no floor falls nowhere: its floor is its surface.
        waterFallFloors?.push(
            face.fallFloors?.[vertexIndex] ?? face.surfaceY ?? vertex[1],
        );
    }

    // Wind each triangle counter-clockwise around its normals. The z-facing
    // sides list their corners the other way round, and a lit double-sided
    // material takes a triangle seen from its back as facing away: it flips
    // the normal and that side loses its light.
    for (const triangle of waterRimQuadTriangles(
        face.vertices,
        vertexNormals,
    )) {
        indices.push(...triangle.map((corner) => startIndex + corner));
    }
}

function createGeometryFromFaces(faces: WaterFace[]) {
    const positions: number[] = [];
    const normals: number[] = [];
    const waterDepths: number[] = [];
    const waterShoreDepths: number[] = [];
    const waterSurfaceYs: number[] = [];
    const waterFallFloors: number[] = [];
    const indices: number[] = [];
    const hasFallFloorMap = faces.some((face) => face.fallFloors !== undefined);
    const hasDepthMap = faces.some(
        (face) =>
            face.depth !== undefined ||
            face.depths !== undefined ||
            face.surfaceY !== undefined,
    );
    const hasShoreDepthMap = faces.some(
        (face) => face.shoreDepths !== undefined,
    );

    for (const face of faces) {
        pushFace({
            face,
            positions,
            normals,
            indices,
            waterDepths: hasDepthMap ? waterDepths : undefined,
            waterFallFloors: hasFallFloorMap ? waterFallFloors : undefined,
            waterShoreDepths: hasShoreDepthMap ? waterShoreDepths : undefined,
            waterSurfaceYs: hasDepthMap ? waterSurfaceYs : undefined,
        });
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    if (hasDepthMap) {
        geometry.setAttribute(
            'waterDepth',
            new Float32BufferAttribute(waterDepths, 1),
        );
        geometry.setAttribute(
            'waterSurfaceY',
            new Float32BufferAttribute(waterSurfaceYs, 1),
        );
    }
    if (hasShoreDepthMap) {
        geometry.setAttribute(
            'waterShoreDepth',
            new Float32BufferAttribute(waterShoreDepths, 1),
        );
    }
    if (hasFallFloorMap) {
        geometry.setAttribute(
            'waterFallFloor',
            new Float32BufferAttribute(waterFallFloors, 1),
        );
    }
    geometry.setIndex(
        positions.length / 3 > 65535
            ? new Uint32BufferAttribute(indices, 1)
            : new Uint16BufferAttribute(indices, 1),
    );
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}

/**
 * One water block. Sides that are exposed (`rimEdges`) round over from the
 * top with a quarter-round lip, and two exposed sides meet in a rounded
 * corner; sides next to water stay open and sides at a bank stay square.
 */
export function createWaterBlockGeometry(
    foamEdges: Vector4,
    {
        height = defaultWaterBlockVisualHeight,
        includeSides = true,
        includeTop = true,
        rimCorners,
        rimEdges,
    }: WaterBlockGeometryOptions = {},
) {
    const foamSides = waterRimSidesFromFlags(foamEdges);
    const rimSides = waterRimSidesFromFlags(rimEdges).map(
        (exposed, side) => exposed && foamSides[side] === true,
    );
    const sides: WaterRimSides = [
        rimSides[0] === true,
        rimSides[1] === true,
        rimSides[2] === true,
        rimSides[3] === true,
    ];
    const top = waterBlockMaxY(height);
    const faces = includeTop
        ? createWaterRimTopQuads({
              corners: waterRimCornersFromFlags(rimCorners),
              sides,
              topY: top,
          }).map(rimQuadToFace)
        : [];

    if (includeSides) {
        for (const face of createWaterSideFaces(height, sides, includeTop)) {
            if (foamEdges[face.edge] > 0.5) {
                faces.push(face);
            }
        }

        for (const [corner, convex] of waterRimConvexCorners(sides).entries()) {
            if (!convex) continue;
            for (const quad of createWaterRimCornerColumnQuads({
                corner,
                yMax: includeTop ? top - waterRimRadius : top,
                yMin: waterBlockMinY(height),
            })) {
                faces.push(rimQuadToFace(quad));
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
        segment.hasDepthMap,
        segment.depthStart,
        segment.depthEnd,
        segment.hasShoreDepthMap,
        segment.shoreDepthStart,
        segment.shoreDepthEnd,
        segment.surfaceY,
        segment.fallFloors?.join(',') ?? '-',
        segment.yMin,
        segment.yMax,
    ].join('|');
}

function verticalSegmentGroupKey(segment: WaterSideSegment) {
    return [
        segment.axis,
        segment.line,
        segment.normal.join(','),
        segment.hasDepthMap,
        segment.depthStart,
        segment.depthEnd,
        segment.hasShoreDepthMap,
        segment.shoreDepthStart,
        segment.shoreDepthEnd,
        segment.surfaceY,
        segment.fallFloors?.join(',') ?? '-',
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

function sideSegmentSamplesConnect(
    currentSegment: WaterSideSegment,
    nextSegment: WaterSideSegment,
) {
    return (
        Math.abs(currentSegment.depthEnd - nextSegment.depthStart) <=
            segmentMergeEpsilon &&
        Math.abs(currentSegment.shoreDepthEnd - nextSegment.shoreDepthStart) <=
            segmentMergeEpsilon
    );
}

/**
 * A floor that slopes along a wall is interpolated across one face only, so
 * only walls with a level floor (or none) merge along their run.
 */
function sideSegmentFloorIsLevel(segment: WaterSideSegment) {
    return (
        segment.fallFloors === null ||
        Math.abs(segment.fallFloors[0] - segment.fallFloors[1]) <=
            segmentMergeEpsilon
    );
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
                segment.start <= currentSegment.end + segmentMergeEpsilon &&
                sideSegmentSamplesConnect(currentSegment, segment) &&
                sideSegmentFloorIsLevel(currentSegment)
            ) {
                currentSegment.end = Math.max(currentSegment.end, segment.end);
                currentSegment.depthEnd = segment.depthEnd;
                currentSegment.shoreDepthEnd = segment.shoreDepthEnd;
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

function segmentDepthsForFace(
    segment: Pick<
        WaterSideSegment,
        | 'depthEnd'
        | 'depthStart'
        | 'hasDepthMap'
        | 'hasShoreDepthMap'
        | 'shoreDepthEnd'
        | 'shoreDepthStart'
    >,
    order: 'start-first' | 'end-first',
) {
    const firstDepth =
        order === 'start-first' ? segment.depthStart : segment.depthEnd;
    const secondDepth =
        order === 'start-first' ? segment.depthEnd : segment.depthStart;
    const firstShoreDepth =
        order === 'start-first'
            ? segment.shoreDepthStart
            : segment.shoreDepthEnd;
    const secondShoreDepth =
        order === 'start-first'
            ? segment.shoreDepthEnd
            : segment.shoreDepthStart;

    return {
        ...(segment.hasDepthMap
            ? {
                  depths: [
                      firstDepth,
                      firstDepth,
                      secondDepth,
                      secondDepth,
                  ] satisfies WaterBlockDepthSamples,
              }
            : {}),
        ...(segment.hasShoreDepthMap
            ? {
                  shoreDepths: [
                      firstShoreDepth,
                      firstShoreDepth,
                      secondShoreDepth,
                      secondShoreDepth,
                  ] satisfies WaterBlockDepthSamples,
              }
            : {}),
    };
}

function segmentFallFloorsForFace(
    segment: Pick<WaterSideSegment, 'fallFloors'>,
    order: 'start-first' | 'end-first',
) {
    if (segment.fallFloors === null) return {};
    const [start, end] = segment.fallFloors;
    const [first, second] =
        order === 'start-first' ? [start, end] : [end, start];
    return {
        fallFloors: [
            first,
            first,
            second,
            second,
        ] satisfies WaterFaceVertexValues,
    };
}

function waterSideSegmentToFace(segment: WaterSideSegment): WaterFace {
    const { end, line, normal, start, yMax, yMin } = segment;

    if (segment.axis === 'z') {
        return {
            ...segmentFallFloorsForFace(
                segment,
                normal[2] < 0 ? 'end-first' : 'start-first',
            ),
            ...(segment.hasDepthMap ? { depth: segment.depth } : {}),
            ...segmentDepthsForFace(
                segment,
                normal[2] < 0 ? 'end-first' : 'start-first',
            ),
            normal,
            ...(segment.hasDepthMap ? { surfaceY: segment.surfaceY } : {}),
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
        ...segmentFallFloorsForFace(
            segment,
            normal[0] < 0 ? 'end-first' : 'start-first',
        ),
        ...(segment.hasDepthMap ? { depth: segment.depth } : {}),
        ...segmentDepthsForFace(
            segment,
            normal[0] < 0 ? 'end-first' : 'start-first',
        ),
        normal,
        ...(segment.hasDepthMap ? { surfaceY: segment.surfaceY } : {}),
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

function getWaterSideInstanceDepth(instance: WaterSideInstance) {
    return instance.depth ?? 1;
}

function getWaterSideInstanceDepthSamples(instance: WaterSideInstance) {
    const depth = getWaterSideInstanceDepth(instance);

    return instance.depthSamples ?? [depth, depth, depth, depth];
}

function getWaterSideInstanceShoreDepthSamples(instance: WaterSideInstance) {
    return instance.shoreDepthSamples ?? [0, 0, 0, 0];
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

function rangeCovers(
    ranges: WaterSideInstanceRange[],
    range: WaterSideInstanceRange,
) {
    return ranges.some(
        (candidate) =>
            candidate.min <= range.min + segmentMergeEpsilon &&
            candidate.max >= range.max - segmentMergeEpsilon,
    );
}

/** Whether another water block in the same column starts at this top. */
function hasWaterDirectlyAbove(
    stackGroups: Map<string, WaterSideInstance[]>,
    x: number,
    z: number,
    range: WaterSideInstanceRange,
) {
    return (
        stackGroups.get(stackPositionKey(x, z))?.some((candidate) => {
            const candidateRange = getWaterSideInstanceRange(candidate);
            return (
                candidateRange.min <= range.max + segmentMergeEpsilon &&
                candidateRange.max > range.max + segmentMergeEpsilon
            );
        }) ?? false
    );
}

/**
 * A wall carries its fall's floor at both ends, read from the side's floor
 * profile (`waterfall/waterfallFloorProfile.ts`), so the water lands along
 * a slope beside it. A stair step splits the wall at the side's middle,
 * where the floor jumps; the depth samples split with it.
 */
function withFallFloors(
    segment: Omit<WaterSideSegment, 'fallFloors'>,
    sideStart: number,
    profile: WaterfallFloorProfile | undefined,
): WaterSideSegment[] {
    if (!profile) return [{ ...segment, fallFloors: null }];
    const spans = waterfallFloorSpans(
        profile,
        segment.start - sideStart,
        segment.end - sideStart,
    );
    const middleDepth = (segment.depthStart + segment.depthEnd) / 2;
    const middleShoreDepth =
        (segment.shoreDepthStart + segment.shoreDepthEnd) / 2;
    const split = spans.length > 1;
    return spans.map((span, index) => ({
        ...segment,
        depthEnd: split && index === 0 ? middleDepth : segment.depthEnd,
        depthStart: split && index > 0 ? middleDepth : segment.depthStart,
        end: index === spans.length - 1 ? segment.end : sideStart + span.to,
        fallFloors: [span.floorFrom, span.floorTo],
        shoreDepthEnd:
            split && index === 0 ? middleShoreDepth : segment.shoreDepthEnd,
        shoreDepthStart:
            split && index > 0 ? middleShoreDepth : segment.shoreDepthStart,
        start: index === 0 ? segment.start : sideStart + span.from,
    }));
}

/** Depth sample index of each rim corner (foam corner order). */
const rimCornerDepthSample = [0, 3, 1, 2] as const;

type WaterSideCall = {
    axis: 'x' | 'z';
    depthEnd: number;
    depthStart: number;
    end: number;
    line: number;
    neighborX: number;
    neighborZ: number;
    normal: Vec3;
    shoreDepthEnd: number;
    shoreDepthStart: number;
    start: number;
};

/**
 * Side walls of many water blocks, merged into long walls where they line
 * up. A wall shows only where no water stands next to it. Blocks with
 * `rimEdges` get the rounded rim: an exposed wall stops one radius below a
 * visible top, where the top's lip takes over, and two exposed walls meet in
 * a rounded vertical corner.
 */
export function createMergedWaterSideGeometry(
    instances: WaterSideInstance[],
    options: { neighborInstances?: WaterSideInstance[] } = {},
) {
    const stackGroups = groupWaterSideInstancesByStackPosition(
        options.neighborInstances ?? instances,
    );
    const sideSegments: WaterSideSegment[] = [];
    const cornerFaces: WaterFace[] = [];

    for (const instance of instances) {
        const [x, y, z] = instance.position;
        const height = getWaterSideInstanceHeight(instance);
        const yMin = y + waterBlockMinY(height);
        const yMax = y + waterBlockMaxY(height);
        const range = { min: yMin, max: yMax };
        const hasDepthMap =
            instance.depth !== undefined ||
            instance.depthSamples !== undefined ||
            instance.surfaceY !== undefined;
        const hasShoreDepthMap = instance.shoreDepthSamples !== undefined;
        const depth = hasDepthMap ? getWaterSideInstanceDepth(instance) : 1;
        const depthSamples = getWaterSideInstanceDepthSamples(instance);
        const shoreDepthSamples =
            getWaterSideInstanceShoreDepthSamples(instance);
        const surfaceY = hasDepthMap ? (instance.surfaceY ?? yMax) : 0;
        const sides = waterRimSidesFromFlags(instance.rimEdges);
        const topVisible =
            sides.includes(true) &&
            !hasWaterDirectlyAbove(stackGroups, x, z, range);
        const calls: WaterSideCall[] = [
            {
                axis: 'x',
                depthStart: depthSamples[0],
                depthEnd: depthSamples[1],
                end: z + waterBlockHalfSize,
                line: x - waterBlockHalfSize,
                neighborX: x - 1,
                neighborZ: z,
                normal: [-1, 0, 0],
                shoreDepthStart: shoreDepthSamples[0],
                shoreDepthEnd: shoreDepthSamples[1],
                start: z - waterBlockHalfSize,
            },
            {
                axis: 'x',
                depthStart: depthSamples[3],
                depthEnd: depthSamples[2],
                end: z + waterBlockHalfSize,
                line: x + waterBlockHalfSize,
                neighborX: x + 1,
                neighborZ: z,
                normal: [1, 0, 0],
                shoreDepthStart: shoreDepthSamples[3],
                shoreDepthEnd: shoreDepthSamples[2],
                start: z - waterBlockHalfSize,
            },
            {
                axis: 'z',
                depthStart: depthSamples[0],
                depthEnd: depthSamples[3],
                end: x + waterBlockHalfSize,
                line: z - waterBlockHalfSize,
                neighborX: x,
                neighborZ: z - 1,
                normal: [0, 0, -1],
                shoreDepthStart: shoreDepthSamples[0],
                shoreDepthEnd: shoreDepthSamples[3],
                start: x - waterBlockHalfSize,
            },
            {
                axis: 'z',
                depthStart: depthSamples[1],
                depthEnd: depthSamples[2],
                end: x + waterBlockHalfSize,
                line: z + waterBlockHalfSize,
                neighborX: x,
                neighborZ: z + 1,
                normal: [0, 0, 1],
                shoreDepthStart: shoreDepthSamples[1],
                shoreDepthEnd: shoreDepthSamples[2],
                start: x - waterBlockHalfSize,
            },
        ];
        const visibleRanges = calls.map((call) =>
            getVisibleWaterSideRanges({
                range,
                stackGroups,
                x: call.neighborX,
                z: call.neighborZ,
            }),
        );
        const rimTop = (visibleRange: WaterSideInstanceRange) =>
            topVisible &&
            Math.abs(visibleRange.max - range.max) <= segmentMergeEpsilon;

        for (const [side, call] of calls.entries()) {
            const trims = waterRimSideTrims(side, sides);
            const [startSide, endSide] = call.axis === 'x' ? [2, 3] : [0, 1];

            for (const visibleRange of visibleRanges[side] ?? []) {
                const trimStart =
                    trims.start &&
                    rangeCovers(visibleRanges[startSide] ?? [], visibleRange);
                const trimEnd =
                    trims.end &&
                    rangeCovers(visibleRanges[endSide] ?? [], visibleRange);
                const wallTop =
                    sides[side] && rimTop(visibleRange)
                        ? visibleRange.max - waterRimRadius
                        : visibleRange.max;

                if (wallTop - visibleRange.min <= segmentMergeEpsilon) {
                    continue;
                }

                sideSegments.push(
                    ...withFallFloors(
                        {
                            axis: call.axis,
                            depth,
                            depthEnd: call.depthEnd,
                            depthStart: call.depthStart,
                            end: call.end - (trimEnd ? waterRimRadius : 0),
                            hasDepthMap,
                            hasShoreDepthMap,
                            line: call.line,
                            normal: call.normal,
                            shoreDepthEnd: call.shoreDepthEnd,
                            shoreDepthStart: call.shoreDepthStart,
                            start:
                                call.start + (trimStart ? waterRimRadius : 0),
                            surfaceY,
                            yMax: wallTop,
                            yMin: visibleRange.min,
                        },
                        call.start,
                        instance.fallFloors?.[side],
                    ),
                );
            }
        }

        for (const [corner, convex] of waterRimConvexCorners(sides).entries()) {
            if (!convex) continue;
            const xSide = corner === 0 || corner === 2 ? 0 : 1;
            const zSide = corner < 2 ? 2 : 3;
            const sampleIndex = rimCornerDepthSample[corner] ?? 0;
            const cornerDepth = depthSamples[sampleIndex];
            const cornerShoreDepth = shoreDepthSamples[sampleIndex];
            // A corner falls as far as the lower of its two sides.
            const cornerFloor = instance.fallFloors
                ? waterfallCornerFloor(instance.fallFloors, corner)
                : null;
            const cornerFall =
                cornerFloor === null
                    ? {}
                    : {
                          fallFloors: [
                              cornerFloor,
                              cornerFloor,
                              cornerFloor,
                              cornerFloor,
                          ] satisfies WaterFaceVertexValues,
                      };

            for (const visibleRange of visibleRanges[xSide] ?? []) {
                if (!rangeCovers(visibleRanges[zSide] ?? [], visibleRange)) {
                    continue;
                }

                for (const quad of createWaterRimCornerColumnQuads({
                    corner,
                    yMax:
                        (rimTop(visibleRange)
                            ? visibleRange.max - waterRimRadius
                            : visibleRange.max) - y,
                    yMin: visibleRange.min - y,
                })) {
                    const face = rimQuadToFace(quad);
                    cornerFaces.push({
                        ...face,
                        ...cornerFall,
                        ...(hasDepthMap
                            ? {
                                  depth,
                                  depths: [
                                      cornerDepth,
                                      cornerDepth,
                                      cornerDepth,
                                      cornerDepth,
                                  ],
                                  surfaceY,
                              }
                            : {}),
                        ...(hasShoreDepthMap
                            ? {
                                  shoreDepths: [
                                      cornerShoreDepth,
                                      cornerShoreDepth,
                                      cornerShoreDepth,
                                      cornerShoreDepth,
                                  ],
                              }
                            : {}),
                        vertices: offsetFaceVertices(face.vertices, [x, y, z]),
                    });
                }
            }
        }
    }

    return createGeometryFromFaces([
        ...mergeSideSegments(sideSegments).map(waterSideSegmentToFace),
        ...cornerFaces,
    ]);
}
