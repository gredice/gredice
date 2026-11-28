/**
 * Rounded rim of block water.
 *
 * Water tiles meet each other flush, so a pond reads as one surface. Where a
 * tile's side is exposed (nothing at the water's height next to it: the
 * island edge, a raised or lone block, a step down to lower water) the top
 * rounds over into the side with a quarter-round lip, and two exposed sides
 * meet in a rounded vertical corner. Sides that face a bank stay square: the
 * bank's grass lip covers them.
 *
 * Local frame: tile centre at the origin, x and z from -0.5 to 0.5. Sides
 * and corners use the foam edge and foam corner order of `waterBlockFoam`.
 */

/** Radius of the rounded lip and corners; terrain caps use 0.06 to 0.08. */
export const waterRimRadius = 0.06;
/** Quarter-round steps of the lip and corners. */
export const waterRimSegments = 4;

type Vec3 = [number, number, number];

export type WaterRimVertex = {
    normal: Vec3;
    position: Vec3;
};

/** Four vertices of a quad, in strip order around its outline. */
export type WaterRimQuad = [
    WaterRimVertex,
    WaterRimVertex,
    WaterRimVertex,
    WaterRimVertex,
];

/** Exposed sides, in foam edge order: -x, +x, -z, +z. */
export type WaterRimSides = readonly [boolean, boolean, boolean, boolean];
/**
 * Inner corners whose diagonal neighbour is exposed while both side
 * neighbours are water, in foam corner order: (-x,-z), (+x,-z), (-x,+z),
 * (+x,+z). The lips of the two neighbours turn the corner inside this tile.
 */
export type WaterRimCorners = readonly [boolean, boolean, boolean, boolean];

export const noWaterRimSides: WaterRimSides = [false, false, false, false];
export const noWaterRimCorners: WaterRimCorners = [false, false, false, false];

/** Rim flags as stored on instances: a side or corner is set above 0.5. */
export type WaterRimFlags = {
    readonly w: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
};

export function waterRimSidesFromFlags(
    flags: WaterRimFlags | undefined,
): WaterRimSides {
    return flags
        ? [flags.x > 0.5, flags.y > 0.5, flags.z > 0.5, flags.w > 0.5]
        : noWaterRimSides;
}

export function waterRimCornersFromFlags(
    flags: WaterRimFlags | undefined,
): WaterRimCorners {
    return flags
        ? [flags.x > 0.5, flags.y > 0.5, flags.z > 0.5, flags.w > 0.5]
        : noWaterRimCorners;
}

const sideNormals: readonly Vec3[] = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, 0, -1],
    [0, 0, 1],
];

/** The x side and the z side that meet at each corner. */
const cornerSides = [
    [0, 2],
    [1, 2],
    [0, 3],
    [1, 3],
] as const;

/** The sides at the start and end of each side, along its run. */
const sideEnds = [
    [2, 3],
    [2, 3],
    [0, 1],
    [0, 1],
] as const;

function sideNormal(side: number): Vec3 {
    return sideNormals[side] ?? [0, 1, 0];
}

function cornerSign(corner: number) {
    return {
        x: corner === 0 || corner === 2 ? -1 : 1,
        z: corner === 0 || corner === 1 ? -1 : 1,
    };
}

/** Point on side `side` at `along` its run and `outward` from the centre. */
function sidePoint(side: number, along: number, outward: number, y: number) {
    const [nx, , nz] = sideNormal(side);
    return nx !== 0
        ? ([nx * outward, y, along] satisfies Vec3)
        : ([along, y, nz * outward] satisfies Vec3);
}

/** Quarter-round lip profile: from flat top (step 0) down to the side. */
function lipProfile(step: number, topY: number) {
    const angle = (Math.PI / 2) * (step / waterRimSegments);
    return {
        across: Math.cos(angle),
        outward: 0.5 - waterRimRadius + waterRimRadius * Math.sin(angle),
        out: Math.sin(angle),
        y: topY - waterRimRadius + waterRimRadius * Math.cos(angle),
    };
}

function pushLip(
    quads: WaterRimQuad[],
    side: number,
    from: number,
    to: number,
    topY: number,
) {
    if (to - from <= 1e-6) return;
    const [nx, , nz] = sideNormal(side);
    const vertexAt = (step: number, along: number): WaterRimVertex => {
        const profile = lipProfile(step, topY);
        return {
            normal: [nx * profile.out, profile.across, nz * profile.out],
            position: sidePoint(side, along, profile.outward, profile.y),
        };
    };

    for (let step = 0; step < waterRimSegments; step++) {
        quads.push([
            vertexAt(step, from),
            vertexAt(step + 1, from),
            vertexAt(step + 1, to),
            vertexAt(step, to),
        ]);
    }
}

/** Rounded top corner where two exposed sides meet: an eighth of a sphere. */
function pushCornerCap(quads: WaterRimQuad[], corner: number, topY: number) {
    const [xSide, zSide] = cornerSides[corner] ?? [0, 2];
    const a = sideNormal(xSide);
    const b = sideNormal(zSide);
    const sign = cornerSign(corner);
    const center: Vec3 = [
        sign.x * (0.5 - waterRimRadius),
        topY - waterRimRadius,
        sign.z * (0.5 - waterRimRadius),
    ];
    const vertexAt = (polar: number, azimuth: number): WaterRimVertex => {
        const phi = (Math.PI / 2) * (polar / waterRimSegments);
        const lambda = (Math.PI / 2) * (azimuth / waterRimSegments);
        const horizontal = Math.sin(phi);
        const normal: Vec3 = [
            horizontal * (Math.cos(lambda) * a[0] + Math.sin(lambda) * b[0]),
            Math.cos(phi),
            horizontal * (Math.cos(lambda) * a[2] + Math.sin(lambda) * b[2]),
        ];
        return {
            normal,
            position: [
                center[0] + waterRimRadius * normal[0],
                center[1] + waterRimRadius * normal[1],
                center[2] + waterRimRadius * normal[2],
            ],
        };
    };

    for (let polar = 0; polar < waterRimSegments; polar++) {
        for (let azimuth = 0; azimuth < waterRimSegments; azimuth++) {
            quads.push([
                vertexAt(polar, azimuth),
                vertexAt(polar + 1, azimuth),
                vertexAt(polar + 1, azimuth + 1),
                vertexAt(polar, azimuth + 1),
            ]);
        }
    }
}

function uniqueSorted(values: number[]) {
    return [...new Set(values.map((value) => Number(value.toFixed(6))))].sort(
        (left, right) => left - right,
    );
}

function hasNotch(
    corner: number,
    sides: WaterRimSides,
    corners: WaterRimCorners,
) {
    const [xSide, zSide] = cornerSides[corner] ?? [0, 2];
    return Boolean(corners[corner]) && !sides[xSide] && !sides[zSide];
}

/**
 * The visible top of one water tile: the flat surface, pulled in by the
 * radius on exposed sides, and the rounded lips and corner caps around it.
 * With nothing exposed it is a single quad, as before.
 */
export function createWaterRimTopQuads({
    corners = noWaterRimCorners,
    sides = noWaterRimSides,
    topY,
}: {
    corners?: WaterRimCorners;
    sides?: WaterRimSides;
    topY: number;
}) {
    const r = waterRimRadius;
    const notches = [0, 1, 2, 3].map((corner) =>
        hasNotch(corner, sides, corners),
    );
    const xs = uniqueSorted([
        sides[0] ? -0.5 + r : -0.5,
        sides[1] ? 0.5 - r : 0.5,
        ...(notches[0] || notches[2] ? [-0.5 + r] : []),
        ...(notches[1] || notches[3] ? [0.5 - r] : []),
    ]);
    const zs = uniqueSorted([
        sides[2] ? -0.5 + r : -0.5,
        sides[3] ? 0.5 - r : 0.5,
        ...(notches[0] || notches[1] ? [-0.5 + r] : []),
        ...(notches[2] || notches[3] ? [0.5 - r] : []),
    ]);
    const quads: WaterRimQuad[] = [];
    const up: Vec3 = [0, 1, 0];

    for (let xi = 0; xi < xs.length - 1; xi++) {
        for (let zi = 0; zi < zs.length - 1; zi++) {
            const x0 = xs[xi] ?? 0;
            const x1 = xs[xi + 1] ?? 0;
            const z0 = zs[zi] ?? 0;
            const z1 = zs[zi + 1] ?? 0;
            const cx = (x0 + x1) / 2;
            const cz = (z0 + z1) / 2;
            const inNotch = notches.some((notch, corner) => {
                const sign = cornerSign(corner);
                return (
                    notch &&
                    sign.x * cx > 0.5 - r - 1e-6 &&
                    sign.z * cz > 0.5 - r - 1e-6
                );
            });
            if (inNotch) continue;
            quads.push([
                { normal: up, position: [x0, topY, z0] },
                { normal: up, position: [x0, topY, z1] },
                { normal: up, position: [x1, topY, z1] },
                { normal: up, position: [x1, topY, z0] },
            ]);
        }
    }

    for (const [side, exposed] of sides.entries()) {
        if (!exposed) continue;
        const [startSide, endSide] = sideEnds[side] ?? [0, 1];
        pushLip(
            quads,
            side,
            sides[startSide] ? -0.5 + r : -0.5,
            sides[endSide] ? 0.5 - r : 0.5,
            topY,
        );
    }

    for (const [corner, [xSide, zSide]] of cornerSides.entries()) {
        if (sides[xSide] && sides[zSide]) {
            pushCornerCap(quads, corner, topY);
        }
        if (notches[corner]) {
            // The neighbours' lips turn the inner corner here. Each runs one
            // radius into this tile; where they overlap, the higher one shows,
            // which forms the mitre.
            const sign = cornerSign(corner);
            const xRange = [sign.x * (0.5 - r), sign.x * 0.5].sort(
                (left, right) => left - right,
            );
            const zRange = [sign.z * (0.5 - r), sign.z * 0.5].sort(
                (left, right) => left - right,
            );
            pushLip(quads, zSide, xRange[0] ?? 0, xRange[1] ?? 0, topY);
            pushLip(quads, xSide, zRange[0] ?? 0, zRange[1] ?? 0, topY);
        }
    }

    return quads;
}

/** Whether the corner at the start or end of `side` rounds off. */
export function waterRimSideTrims(side: number, sides: WaterRimSides) {
    const [startSide, endSide] = sideEnds[side] ?? [0, 1];
    return {
        end: Boolean(sides[side] && sides[endSide]),
        start: Boolean(sides[side] && sides[startSide]),
    };
}

/** Convex vertical corners: both sides that meet there are exposed. */
export function waterRimConvexCorners(sides: WaterRimSides) {
    return cornerSides.map(([xSide, zSide]) =>
        Boolean(sides[xSide] && sides[zSide]),
    );
}

/** Rounded vertical corner between two exposed sides, from yMin to yMax. */
export function createWaterRimCornerColumnQuads({
    corner,
    yMax,
    yMin,
}: {
    corner: number;
    yMax: number;
    yMin: number;
}) {
    const quads: WaterRimQuad[] = [];
    if (yMax - yMin <= 1e-6) return quads;
    const [xSide, zSide] = cornerSides[corner] ?? [0, 2];
    const a = sideNormal(xSide);
    const b = sideNormal(zSide);
    const sign = cornerSign(corner);
    const axisX = sign.x * (0.5 - waterRimRadius);
    const axisZ = sign.z * (0.5 - waterRimRadius);
    const vertexAt = (azimuth: number, y: number): WaterRimVertex => {
        const lambda = (Math.PI / 2) * (azimuth / waterRimSegments);
        const normal: Vec3 = [
            Math.cos(lambda) * a[0] + Math.sin(lambda) * b[0],
            0,
            Math.cos(lambda) * a[2] + Math.sin(lambda) * b[2],
        ];
        return {
            normal,
            position: [
                axisX + waterRimRadius * normal[0],
                y,
                axisZ + waterRimRadius * normal[2],
            ],
        };
    };

    for (let azimuth = 0; azimuth < waterRimSegments; azimuth++) {
        quads.push([
            vertexAt(azimuth, yMin),
            vertexAt(azimuth, yMax),
            vertexAt(azimuth + 1, yMax),
            vertexAt(azimuth + 1, yMin),
        ]);
    }

    return quads;
}

/**
 * Index order for one quad, two triangles each wound counter-clockwise
 * around its vertex normals. Triangles that collapse to a point, such as the
 * pole of a corner cap, are left out.
 */
export function waterRimQuadTriangles(
    positions: readonly Vec3[],
    normals: readonly Vec3[],
) {
    const triangles: Array<[number, number, number]> = [];

    for (const [a, b, c] of [
        [0, 1, 2],
        [0, 2, 3],
    ] as const) {
        const pa = positions[a];
        const pb = positions[b];
        const pc = positions[c];
        if (!pa || !pb || !pc) continue;
        const ab = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
        const ac = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
        const cross = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        ];
        const area = Math.hypot(cross[0] ?? 0, cross[1] ?? 0, cross[2] ?? 0);
        if (area <= 1e-12) continue;
        const normal = [0, 1, 2].map(
            (axis) =>
                (normals[a]?.[axis] ?? 0) +
                (normals[b]?.[axis] ?? 0) +
                (normals[c]?.[axis] ?? 0),
        );
        const facing =
            (cross[0] ?? 0) * (normal[0] ?? 0) +
            (cross[1] ?? 0) * (normal[1] ?? 0) +
            (cross[2] ?? 0) * (normal[2] ?? 0);
        triangles.push(facing >= 0 ? [a, b, c] : [a, c, b]);
    }

    return triangles;
}
