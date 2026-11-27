/**
 * Where a waterfall lands along one side of a water tile, from the side's
 * start to its end (-z to +z on an x side, -x to +x on a z side): at the
 * start, just before and just after the middle, and at the end, the samples
 * the terrain rim reads a top with (`terrainRim/terrainShapes.ts`). Flat
 * ground and water are level, a ramp or corner slopes straight from end to
 * end and a stair step jumps at the middle.
 */
export type WaterfallFloorProfile = readonly [number, number, number, number];

/** Floor profiles of the four sides of a tile, in foam edge order. */
export type WaterfallFloors = readonly [
    WaterfallFloorProfile,
    WaterfallFloorProfile,
    WaterfallFloorProfile,
    WaterfallFloorProfile,
];

/** One stretch of a side over which the floor runs straight. */
export type WaterfallFloorSpan = {
    /** Start of the stretch, 0 at the side's start and 1 at its end. */
    from: number;
    to: number;
    floorFrom: number;
    floorTo: number;
};

const floorEpsilon = 1e-4;

export function levelWaterfallFloor(height: number): WaterfallFloorProfile {
    return [height, height, height, height];
}

/** Every side level at `height`: a column whose water falls nowhere. */
export function levelWaterfallFloors(height: number): WaterfallFloors {
    const level = levelWaterfallFloor(height);
    return [level, level, level, level];
}

export function isWaterfallFloorLevel(profile: WaterfallFloorProfile) {
    return profile.every(
        (height) => Math.abs(height - profile[0]) <= floorEpsilon,
    );
}

/** Whether the floor runs straight from one end of the side to the other. */
function isWaterfallFloorStraight([
    start,
    beforeMiddle,
    afterMiddle,
    end,
]: WaterfallFloorProfile) {
    return (
        Math.abs(beforeMiddle - afterMiddle) <= floorEpsilon &&
        Math.abs(beforeMiddle - (start + end) / 2) <= floorEpsilon
    );
}

/** The floor at `t` in the side's first half (0 to 0.5). */
function floorInFirstHalf(profile: WaterfallFloorProfile, t: number) {
    return profile[0] + (profile[1] - profile[0]) * (t * 2);
}

/** The floor at `t` in the side's second half (0.5 to 1). */
function floorInSecondHalf(profile: WaterfallFloorProfile, t: number) {
    return profile[2] + (profile[3] - profile[2]) * (t * 2 - 1);
}

/**
 * The stretch [from, to] of a side (0 at its start, 1 at its end) as pieces
 * with a straight floor, and the floor at each end of each piece. A floor
 * that does not run straight, such as a stair step, splits it at the middle.
 */
export function waterfallFloorSpans(
    profile: WaterfallFloorProfile,
    from: number,
    to: number,
): WaterfallFloorSpan[] {
    if (to <= 0.5 + floorEpsilon) {
        return [
            {
                floorFrom: floorInFirstHalf(profile, from),
                floorTo: floorInFirstHalf(profile, Math.min(to, 0.5)),
                from,
                to,
            },
        ];
    }
    if (from >= 0.5 - floorEpsilon) {
        return [
            {
                floorFrom: floorInSecondHalf(profile, Math.max(from, 0.5)),
                floorTo: floorInSecondHalf(profile, to),
                from,
                to,
            },
        ];
    }
    if (isWaterfallFloorStraight(profile)) {
        return [
            {
                floorFrom: floorInFirstHalf(profile, from),
                floorTo: floorInSecondHalf(profile, to),
                from,
                to,
            },
        ];
    }
    return [
        {
            floorFrom: floorInFirstHalf(profile, from),
            floorTo: profile[1],
            from,
            to: 0.5,
        },
        {
            floorFrom: profile[2],
            floorTo: floorInSecondHalf(profile, to),
            from: 0.5,
            to,
        },
    ];
}

/**
 * The foam corner ((-x,-z), (+x,-z), (-x,+z), (+x,+z)) at the start or end
 * of side `side` (foam edge order -x, +x, -z, +z).
 */
export function waterfallSideCorner(side: number, end: 'start' | 'end') {
    const isXSide = side < 2;
    const atNegX = isXSide ? side === 0 : end === 'start';
    const atNegZ = isXSide ? end === 'start' : side === 2;
    return (atNegX ? 0 : 1) + (atNegZ ? 0 : 2);
}

/** Floor of side `side` at foam corner `corner`, one of its two ends. */
export function waterfallSideFloorAtCorner(
    floors: WaterfallFloors,
    side: number,
    corner: number,
) {
    const atNegX = corner === 0 || corner === 2;
    const atNegZ = corner < 2;
    // The corner is the start of each side that runs towards it from -x or
    // -z, and the end of the other.
    const atStart = side < 2 ? atNegZ : atNegX;
    const profile = floors[side];
    return profile ? profile[atStart ? 0 : 3] : Number.NaN;
}

/**
 * Floor at foam corner `corner` ((-x,-z), (+x,-z), (-x,+z), (+x,+z)): the
 * lower of the floors of the two sides that meet there, so a rounded
 * corner falls as far as the lower of them.
 */
export function waterfallCornerFloor(floors: WaterfallFloors, corner: number) {
    const atNegX = corner === 0 || corner === 2;
    const atNegZ = corner < 2;
    return Math.min(
        waterfallSideFloorAtCorner(floors, atNegX ? 0 : 1, corner),
        waterfallSideFloorAtCorner(floors, atNegZ ? 2 : 3, corner),
    );
}
