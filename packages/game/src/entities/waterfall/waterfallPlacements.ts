import type { BlockData } from '@gredice/client';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    getStackHeight,
    isEdgeOrCornerTerrainBlockName,
} from '../../utils/stackHeightCore';
import {
    isSolidTerrainBlockName,
    resolveTerrainColumn,
    sideIndexTowards,
    type TerrainColumnBlock,
    terrainBlockSideHeights,
    terrainNeighbourSideHeights,
    terrainSideGradient,
} from '../terrainRim/terrainShapes';
import { getWaterBlockColumnSurfaceY } from '../waterBlockDepth';
import { resolveWaterRimExposure } from '../waterBlockFoam';
import { getWaterBlockVerticalRange } from '../waterBlockHeight';
import { isWaterBlockName } from '../waterBlockNames';
import { isWaterBlockTopSurfaceVisible } from '../waterBlockSurface';
import {
    isWaterfallFloorLevel,
    levelWaterfallFloor,
    levelWaterfallFloors,
    type WaterfallFloorProfile,
    type WaterfallFloors,
} from './waterfallFloorProfile';

/**
 * Waterfalls on block water.
 *
 * Every exposed side of a water column (`resolveWaterRimExposure`: no water
 * and no terrain at the water's height next to it) spills over its rounded
 * lip and falls down the side. The fall lands on the highest surface below
 * the water in the neighbouring column: the top of its bottom run of terrain,
 * read the way the rim reads it, so it follows a ramp, corner or stairs top;
 * or a lower water top. With no neighbouring column (the island's outer edge)
 * the water falls past the island base and fades out. Water that fills a
 * ramp or corner (`waterBlockHeight`) stands on the block under it, and
 * falls only over the block's low sides: none where the block's own bank
 * rises to its surface or slopes up along the side. Water
 * stacked above the ramp or corner it fills pours over that block's top
 * instead: its crest, its slopes and its low sides.
 *
 * Sides and corners use the foam edge and foam corner order of
 * `waterBlockFoam`: -x, +x, -z, +z and (-x,-z), (+x,-z), (-x,+z), (+x,+z).
 */

/** Floor of a side that falls off the island: far below everything. */
export const waterfallVoidFloorY = -64;
/** Bottom of the island: the terrain rim's soil body ends here. */
export const waterfallIslandBaseY = -0.06;
/**
 * How far the sheet that carries a fall on below the wall sits out from a
 * supporting terrain block's side, so it pours over that block's grass lip
 * (reach 0.07).
 */
export const waterfallSupportedRunoutOffset = 0.08;
/** Run-out of water at the island's own level, just off its wall. */
export const waterfallGroundRunoutOffset = 0.001;
/** A fall must drop at least this far to show; matches the rim tolerance. */
const minimumFallDrop = 0.02;
const heightEpsilon = 1e-4;

export type WaterfallLanding = 'none' | 'terrain' | 'void' | 'water';

/**
 * How one end of a landing skirt finishes:
 * - `corner`: the column's next side falls to the same floor, and a corner
 *   patch rounds the foam around the outer corner;
 * - `continued`: the next column along falls on the same line and floor;
 * - `mitre`: another fall lands on the same tile from the side, and the two
 *   skirts meet on the diagonal;
 * - `free`: nothing continues it, and the foam tapers off.
 */
export type WaterfallSkirtEnd = 'continued' | 'corner' | 'free' | 'mitre';

export type WaterfallSide = {
    /** Where the fall lands; `none` for a covered side. */
    landing: WaterfallLanding;
    /**
     * The lowest point the fall lands on: the column's surface for a covered
     * side, `waterfallVoidFloorY` off the island edge.
     */
    floorY: number;
    /** Where the fall lands along the side; level unless a slope or step. */
    floorProfile: WaterfallFloorProfile;
    /**
     * Whether the fall pours over the column's lip on this side
     * (`WaterfallColumn.lips`) before it lands, because the lip is above
     * the landing somewhere along the side. A sheet carries the fall from
     * that lip down to the landing, and the skirt lies at the sheet's foot.
     * Island-edge falls always have their run-out instead.
     */
    spill: boolean;
    /** Whether a foam skirt lies on the landing surface. */
    skirt: boolean;
    /**
     * How much the landing surface rises per unit away from the wall: the
     * slope under a ramp's toe or crest, so the skirt lies on it; 0 on flat
     * ground and water.
     */
    skirtRise: number;
    /** Skirt end at the side's start (-z for x sides, -x for z sides). */
    skirtStart: WaterfallSkirtEnd;
    /** Skirt end at the side's end (+z for x sides, +x for z sides). */
    skirtEnd: WaterfallSkirtEnd;
};

export type WaterfallSides = readonly [
    WaterfallSide,
    WaterfallSide,
    WaterfallSide,
    WaterfallSide,
];

export type WaterfallColumn = {
    /** Stable signature of everything below, for retained chunk equality. */
    key: string;
    x: number;
    z: number;
    surfaceY: number;
    /** Bottom of the column's lowest water block. */
    bottomY: number;
    /**
     * Top of the terrain the column stands on, or null when the column
     * starts on nothing (water at ground level). Water on a ramp or corner
     * fills it, so it stands on the block under the ramp.
     */
    supportTopY: number | null;
    sides: WaterfallSides;
    /** Convex corners whose two sides' skirts meet in a corner patch. */
    skirtCorners: readonly [boolean, boolean, boolean, boolean];
    /**
     * The grass lip each side's fall pours over, along the side in foam
     * edge order: the top of the block the column stands on, or, for water
     * stacked above the ramp or corner it fills, that block's top along the
     * side (its crest, a slope or a low side), so the sheet pours over the
     * ramp instead of falling behind it. A lip is level or runs straight
     * from one end of the side to the other. Null when the column stands on
     * nothing: its run-out hugs the wall from `runoutTopY`.
     */
    lips: WaterfallFloors | null;
    /**
     * Top of the run-out of a column without lips, where it starts on its
     * wall; the top of the block the column stands on otherwise.
     */
    runoutTopY: number;
    /**
     * How far the sheet that carries a fall on below the wall sits out from
     * the column's wall: clear of the lips' reach, or just off the wall.
     */
    runoutOffset: number;
};

/** Outward direction of each side, in foam edge order. */
export const waterfallSideOffsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
] as const;

/** The sides at the start and end of each side's run. */
export const waterfallSideEnds = [
    [2, 3],
    [2, 3],
    [0, 1],
    [0, 1],
] as const;

/** The x side and z side that meet at each corner. */
export const waterfallCornerSides = [
    [0, 2],
    [1, 2],
    [0, 3],
    [1, 3],
] as const;

function sideTowards(dx: number, dz: number) {
    if (dx < 0) return 0;
    if (dx > 0) return 1;
    if (dz < 0) return 2;
    return 3;
}

function positionKey(x: number, z: number) {
    return `${x}|${z}`;
}

type NeighbourSurface = {
    /** The bottom run of terrain, the column the rim checks. */
    terrain: TerrainColumnBlock[];
    /** The first block above that run. */
    aboveRun: Block | null;
    /** Tops of the water blocks in the column. */
    waterTops: number[];
};

function describeColumn(
    stack: Stack,
    blockData: BlockData[] | null | undefined,
): NeighbourSurface {
    const terrain = resolveTerrainColumn(blockData, stack);
    const waterTops: number[] = [];
    for (const block of stack.blocks) {
        if (!isWaterBlockName(block.name)) continue;
        const range = getWaterBlockVerticalRange({ block, blockData, stack });
        if (range) waterTops.push(range.max);
    }
    return {
        aboveRun: stack.blocks[terrain.length] ?? null,
        terrain,
        waterTops,
    };
}

function sameHeight(left: number, right: number) {
    return Math.abs(left - right) <= heightEpsilon;
}

/** The highest water top of a column at or below `surfaceY`. */
function waterTopAtOrBelow(neighbour: NeighbourSurface, surfaceY: number) {
    let waterTop = Number.NEGATIVE_INFINITY;
    for (const top of neighbour.waterTops) {
        if (top <= surfaceY + heightEpsilon) waterTop = Math.max(waterTop, top);
    }
    return waterTop;
}

/** The side of a terrain block (`terrainShapes` order) facing `side`. */
function terrainSideFacing(side: number) {
    const [dx, dz] = waterfallSideOffsets[side] ?? [0, 0];
    return sideIndexTowards(dx, dz);
}

/**
 * Height of a neighbour's terrain along the edge it shares with side `side`,
 * from the side's start to its end: the heights the rim's cover test reads
 * (`waterBlockFoam.ts`), so a fall shows wherever the lip rounds over.
 */
function terrainAlongSide(
    terrain: readonly TerrainColumnBlock[],
    side: number,
): WaterfallFloorProfile {
    const terrainSide = terrainSideFacing(side);
    const [a, b, c, d] = terrainNeighbourSideHeights(terrain, terrainSide);
    // `terrainShapes` runs its -x and +z sides the other way round.
    return terrainSide >= 2 ? [d, c, b, a] : [a, b, c, d];
}

type ColumnDraft = {
    bottomY: number;
    landings: ResolvedLanding[];
    lips: WaterfallFloors | null;
    supportTopY: number | null;
    surfaceY: number;
    x: number;
    z: number;
};

type ResolvedLanding = Pick<
    WaterfallSide,
    'floorProfile' | 'floorY' | 'landing' | 'skirt' | 'skirtRise' | 'spill'
>;

function stillLanding(surfaceY: number): ResolvedLanding {
    return {
        floorProfile: levelWaterfallFloor(surfaceY),
        floorY: surfaceY,
        landing: 'none',
        skirt: false,
        skirtRise: 0,
        spill: false,
    };
}

function noSide(surfaceY: number): WaterfallSide {
    return {
        ...stillLanding(surfaceY),
        skirtEnd: 'free',
        skirtStart: 'free',
    };
}

/**
 * Lowest water block of the column whose top is `topIndex`, and the top of
 * the terrain block the column stands on, whose lip a spill pours over:
 * null when the column stands on nothing or on a block that is not
 * terrain. Water on a ramp or corner fills that block (`waterBlockHeight`)
 * down to its base, so it stands on the block under the ramp, or on nothing
 * at ground level.
 */
function columnBase(
    blockData: BlockData[] | null | undefined,
    stack: Stack,
    topIndex: number,
) {
    let bottomIndex = topIndex;
    while (
        bottomIndex > 0 &&
        isWaterBlockName(stack.blocks[bottomIndex - 1]?.name ?? '')
    ) {
        bottomIndex -= 1;
    }
    let supportIndex = bottomIndex - 1;
    const filledIndex =
        supportIndex >= 0 &&
        isEdgeOrCornerTerrainBlockName(stack.blocks[supportIndex]?.name ?? '')
            ? supportIndex
            : null;
    if (filledIndex !== null) {
        supportIndex -= 1;
    }
    const support = supportIndex >= 0 ? stack.blocks[supportIndex] : undefined;
    const onSupport = stack.blocks[supportIndex + 1];
    return {
        bottomBlock: stack.blocks[bottomIndex],
        filled:
            filledIndex === null
                ? undefined
                : resolveTerrainColumn(blockData, stack).find(
                      (entry) => entry.blockIndex === filledIndex,
                  ),
        supportTopY:
            support && onSupport && isSolidTerrainBlockName(support.name)
                ? getStackHeight(blockData, stack, onSupport)
                : null,
    };
}

/**
 * Whether the ramp or corner a column fills holds the water on side `side`,
 * so that side shows no fall. A ramp's crest rises to the surface all along
 * the side and hides the wall. Water that fills the block, rather than
 * standing above it, falls only over the block's low sides, where its top
 * stays at its base all along the side: a fall down a sloping side would
 * pour over the bank's soil face, as if through the block.
 */
function heldByFilledBlock(
    filled: TerrainColumnBlock | undefined,
    side: number,
    surfaceY: number,
) {
    if (!filled) return false;
    const heights = terrainBlockSideHeights(filled, terrainSideFacing(side));
    if (Math.min(...heights) >= surfaceY - heightEpsilon) return true;
    const fills = surfaceY <= filled.base + filled.height + heightEpsilon;
    return fills && Math.max(...heights) > filled.base + heightEpsilon;
}

/** Top of a terrain block along side `side`, from the side's start. */
function blockTopAlongSide(
    entry: TerrainColumnBlock,
    side: number,
): WaterfallFloorProfile {
    const terrainSide = terrainSideFacing(side);
    const [a, b, c, d] = terrainBlockSideHeights(entry, terrainSide);
    // `terrainShapes` runs its -x and +z sides the other way round.
    return terrainSide >= 2 ? [d, c, b, a] : [a, b, c, d];
}

/**
 * The lip each side of a column falls over (`WaterfallColumn.lips`). Water
 * stacked above the ramp or corner it fills stands taller than that block's
 * bank, which wraps the foot of its walls: each side's fall pours over the
 * block's top along that side. Otherwise every side pours over the top of
 * the block the column stands on, if any.
 */
function columnLips(
    filled: TerrainColumnBlock | undefined,
    supportTopY: number | null,
    surfaceY: number,
): WaterfallFloors | null {
    if (filled && surfaceY > filled.base + filled.height + heightEpsilon) {
        return [
            blockTopAlongSide(filled, 0),
            blockTopAlongSide(filled, 1),
            blockTopAlongSide(filled, 2),
            blockTopAlongSide(filled, 3),
        ];
    }
    return supportTopY === null ? null : levelWaterfallFloors(supportTopY);
}

/**
 * The waterfalls of every visible water surface in the garden: for each
 * water column, where each side falls to and how its landing foam ends.
 * Covered sides (a bank or water at the same level, or the crest of the
 * ramp the water fills) get `none`.
 */
export function resolveWaterfallColumns({
    blockData,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: Stack[] | undefined;
}): WaterfallColumn[] {
    if (!blockData || !stacks?.length) return [];
    // Most gardens have no water; skip the neighbour index for them.
    const hasWater = stacks.some((stack) =>
        stack.blocks.some((block) => isWaterBlockName(block.name)),
    );
    if (!hasWater) return [];
    const stackByPosition = new Map<string, Stack>();
    for (const stack of stacks) {
        stackByPosition.set(
            positionKey(stack.position.x, stack.position.z),
            stack,
        );
    }
    const surfaces = new Map<Stack, NeighbourSurface>();
    const surfaceAt = (x: number, z: number) => {
        const stack = stackByPosition.get(positionKey(x, z));
        if (!stack || stack.blocks.length === 0) return null;
        let surface = surfaces.get(stack);
        if (!surface) {
            surface = describeColumn(stack, blockData);
            surfaces.set(stack, surface);
        }
        return surface;
    };

    const drafts: ColumnDraft[] = [];
    for (const stack of stacks) {
        for (const [blockIndex, block] of stack.blocks.entries()) {
            if (!isWaterBlockName(block.name)) continue;
            if (!isWaterBlockTopSurfaceVisible({ block, stack })) continue;
            const { x, z } = stack.position;
            const surfaceY = getWaterBlockColumnSurfaceY({
                block,
                blockData,
                stack,
            });
            const { bottomBlock, filled, supportTopY } = columnBase(
                blockData,
                stack,
                blockIndex,
            );
            const lips = columnLips(filled, supportTopY, surfaceY);
            const bottomRange = bottomBlock
                ? getWaterBlockVerticalRange({
                      block: bottomBlock,
                      blockData,
                      stack,
                  })
                : null;
            const rim = resolveWaterRimExposure({
                block,
                blockData,
                stack,
                stacks,
            });
            const exposed = [
                rim.edges.x,
                rim.edges.y,
                rim.edges.z,
                rim.edges.w,
            ];
            drafts.push({
                bottomY: bottomRange?.min ?? surfaceY,
                landings: waterfallSideOffsets.map(([dx, dz], side) =>
                    resolveLanding({
                        exposed:
                            (exposed[side] ?? 0) > 0.5 &&
                            !heldByFilledBlock(filled, side, surfaceY),
                        lip: lips?.[side] ?? null,
                        neighbour: surfaceAt(x + dx, z + dz),
                        side,
                        surfaceY,
                    }),
                ),
                lips,
                supportTopY,
                surfaceY,
                x,
                z,
            });
        }
    }

    const draftsByPosition = new Map<string, ColumnDraft[]>();
    for (const draft of drafts) {
        const key = positionKey(draft.x, draft.z);
        const list = draftsByPosition.get(key);
        if (list) list.push(draft);
        else draftsByPosition.set(key, [draft]);
    }
    /**
     * Whether a column at (x, z) lays a skirt on `side` that lines up with
     * `skirt`: the same floor, slope and distance from the wall.
     */
    const skirtsAt = (
        x: number,
        z: number,
        side: number,
        skirt: ResolvedLanding,
    ) =>
        draftsByPosition.get(positionKey(x, z))?.some((draft) => {
            const other = draft.landings[side];
            return (
                other?.skirt === true &&
                sameHeight(other.floorY, skirt.floorY) &&
                sameHeight(other.skirtRise, skirt.skirtRise) &&
                other.spill === skirt.spill
            );
        }) ?? false;

    return drafts.map((draft) => finishColumn(draft, skirtsAt, surfaceAt));
}

function resolveLanding({
    exposed,
    lip,
    neighbour,
    side,
    surfaceY,
}: {
    exposed: boolean;
    /** The lip the side's fall pours over (`WaterfallColumn.lips`). */
    lip: WaterfallFloorProfile | null;
    neighbour: NeighbourSurface | null;
    side: number;
    surfaceY: number;
}): ResolvedLanding {
    if (!exposed) return stillLanding(surfaceY);
    if (!neighbour) {
        return {
            floorProfile: levelWaterfallFloor(waterfallVoidFloorY),
            floorY: waterfallVoidFloorY,
            landing: 'void',
            skirt: false,
            skirtRise: 0,
            spill: false,
        };
    }
    const terrain = terrainAlongSide(neighbour.terrain, side);
    const waterTop = waterTopAtOrBelow(neighbour, surfaceY);
    const [start, beforeMiddle, afterMiddle, end] = terrain;
    const floorProfile: WaterfallFloorProfile = [
        Math.max(start, waterTop),
        Math.max(beforeMiddle, waterTop),
        Math.max(afterMiddle, waterTop),
        Math.max(end, waterTop),
    ];
    const floorY = Math.min(...floorProfile);
    if (!Number.isFinite(floorY)) {
        return {
            floorProfile: levelWaterfallFloor(waterfallVoidFloorY),
            floorY: waterfallVoidFloorY,
            landing: 'void',
            skirt: false,
            skirtRise: 0,
            spill: false,
        };
    }
    if (surfaceY - floorY <= minimumFallDrop) return stillLanding(surfaceY);
    const spill =
        lip !== null &&
        floorProfile.some(
            (floor, index) => floor < (lip[index] ?? floor) - heightEpsilon,
        );
    if (waterTop > Math.max(...terrain)) {
        return {
            floorProfile,
            floorY,
            landing: 'water',
            skirt: true,
            skirtRise: 0,
            spill,
        };
    }
    // Foam lies on flat tops and along a ramp's toe or crest, tilted with
    // the ramp; not on a ramp's side, a corner or stairs, where the ground
    // turns under it, nor under a raised bed.
    const top = neighbour.terrain[neighbour.terrain.length - 1];
    const underBed = neighbour.aboveRun?.name.startsWith('Raised_Bed') === true;
    const skirt =
        top !== undefined &&
        (top.shape === 'flat' || top.shape === 'angle') &&
        isWaterfallFloorLevel(floorProfile) &&
        !underBed;
    // The gradient's first part is the rise out of the neighbour's side,
    // towards the water; the skirt runs the other way, into the neighbour.
    const skirtRise =
        skirt && top
            ? -terrainSideGradient(
                  top.shape,
                  top.rotation,
                  terrainSideFacing(side) + 2,
              )[0] * top.height
            : 0;
    return {
        floorProfile,
        floorY,
        landing: 'terrain',
        skirt,
        skirtRise,
        spill,
    };
}

function finishColumn(
    draft: ColumnDraft,
    skirtsAt: (
        x: number,
        z: number,
        side: number,
        skirt: ResolvedLanding,
    ) => boolean,
    surfaceAt: (x: number, z: number) => NeighbourSurface | null,
): WaterfallColumn {
    const { x, z, surfaceY } = draft;
    const sideAt = (side: number) =>
        draft.landings[side] ?? stillLanding(surfaceY);
    /** The diagonal tile outside a corner is flat at `floorY`. */
    const diagonalFlatAt = (dx: number, dz: number, floorY: number) => {
        const diagonal = surfaceAt(x + dx, z + dz);
        if (!diagonal) return false;
        const top = diagonal.terrain[diagonal.terrain.length - 1];
        const flatTerrain =
            top?.shape === 'flat'
                ? top.base + top.height
                : Number.NEGATIVE_INFINITY;
        return sameHeight(
            Math.max(flatTerrain, waterTopAtOrBelow(diagonal, surfaceY)),
            floorY,
        );
    };
    const endOf = (side: number, endSide: number): WaterfallSkirtEnd => {
        const current = sideAt(side);
        const [ox, oz] = waterfallSideOffsets[side] ?? [0, 0];
        const [dx, dz] = waterfallSideOffsets[endSide] ?? [0, 0];
        const next = sideAt(endSide);
        if (
            next.skirt &&
            sameHeight(next.floorY, current.floorY) &&
            next.spill === current.spill &&
            current.skirtRise === 0 &&
            next.skirtRise === 0 &&
            diagonalFlatAt(ox + dx, oz + dz, current.floorY)
        ) {
            return 'corner';
        }
        if (skirtsAt(x + dx, z + dz, side, current)) {
            return 'continued';
        }
        if (
            skirtsAt(x + ox + dx, z + oz + dz, sideTowards(-dx, -dz), current)
        ) {
            return 'mitre';
        }
        return 'free';
    };

    const sides = waterfallSideOffsets.map((_, side): WaterfallSide => {
        const current = sideAt(side);
        if (current.landing === 'none') return noSide(surfaceY);
        const [startSide, endSide] = waterfallSideEnds[side] ?? [0, 1];
        return {
            ...current,
            skirtEnd: current.skirt ? endOf(side, endSide) : 'free',
            skirtStart: current.skirt ? endOf(side, startSide) : 'free',
        };
    });
    const typedSides: WaterfallSides = [
        sides[0] ?? noSide(surfaceY),
        sides[1] ?? noSide(surfaceY),
        sides[2] ?? noSide(surfaceY),
        sides[3] ?? noSide(surfaceY),
    ];
    const skirtCorners = waterfallCornerSides.map(([xSide, zSide]) => {
        const xEnd = waterfallSideEnds[xSide]?.[0] === zSide ? 'start' : 'end';
        const xSideValue = typedSides[xSide];
        return (
            xSideValue.skirt &&
            (xEnd === 'start' ? xSideValue.skirtStart : xSideValue.skirtEnd) ===
                'corner'
        );
    });
    const runoutTopY = draft.supportTopY ?? draft.bottomY;
    const runoutOffset =
        draft.lips === null
            ? waterfallGroundRunoutOffset
            : waterfallSupportedRunoutOffset;
    const column: Omit<WaterfallColumn, 'key'> = {
        bottomY: draft.bottomY,
        lips: draft.lips,
        runoutOffset,
        runoutTopY,
        sides: typedSides,
        skirtCorners: [
            skirtCorners[0] === true,
            skirtCorners[1] === true,
            skirtCorners[2] === true,
            skirtCorners[3] === true,
        ],
        supportTopY: draft.supportTopY,
        surfaceY,
        x,
        z,
    };
    return { ...column, key: waterfallColumnKey(column) };
}

function waterfallColumnKey(column: Omit<WaterfallColumn, 'key'>) {
    return [
        column.x,
        column.z,
        column.surfaceY.toFixed(5),
        column.bottomY.toFixed(5),
        column.supportTopY?.toFixed(5) ?? '-',
        column.runoutTopY.toFixed(5),
        column.runoutOffset,
        column.lips
            ?.map((lip) => lip.map((height) => height.toFixed(5)).join(','))
            .join(';') ?? '-',
        ...column.sides.map((side) =>
            [
                side.landing,
                side.floorProfile.map((height) => height.toFixed(5)).join(','),
                side.spill ? 1 : 0,
                side.skirt ? 1 : 0,
                side.skirtRise.toFixed(5),
                side.skirtStart,
                side.skirtEnd,
            ].join(':'),
        ),
        column.skirtCorners.map((corner) => (corner ? 1 : 0)).join(''),
    ].join('|');
}

/** Floor profiles in foam edge order; a covered side's is its surface. */
export function waterfallFloors(column: WaterfallColumn): WaterfallFloors {
    return [
        column.sides[0].floorProfile,
        column.sides[1].floorProfile,
        column.sides[2].floorProfile,
        column.sides[3].floorProfile,
    ];
}

/** Floors of a column whose water falls nowhere: its own surface. */
export function stillWaterfallFloors(surfaceY: number): WaterfallFloors {
    return levelWaterfallFloors(surfaceY);
}

/** Whether the column has any side that falls. */
export function hasWaterfall(column: WaterfallColumn) {
    return column.sides.some((side) => side.landing !== 'none');
}

/** Key of the water column a block belongs to: position and surface. */
export function waterfallColumnKeyOf(x: number, z: number, surfaceY: number) {
    return `${x}|${z}|${surfaceY.toFixed(6)}`;
}
