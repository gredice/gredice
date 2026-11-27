import type { BlockData } from '@gredice/client';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import {
    type TerrainRimCornerShape,
    type TerrainRimStripNode,
    type TerrainRimStripShape,
    terrainRimDimensions,
    terrainRimPieceShapeKey,
} from './terrainRimGeometry';
import {
    cornerIndexTowards,
    cornerOffset,
    createTerrainColumnLookup,
    isTerrainRimBlockName,
    mod4,
    sideOffsets,
    type TerrainColumnBlock,
    type TerrainRimBlockName,
    type TerrainRimSurface,
    type TerrainSideProfile,
    terrainBlockSideHeights,
    terrainColumnCornerHeight,
    terrainCornerGradients,
    terrainCornerHeight,
    terrainNeighbourSideHeights,
    terrainRimBlockShapes,
    terrainSideGradient,
    terrainSideHasNosing,
    terrainSideProfile,
    terrainStairNosingWidth,
} from './terrainShapes';

export {
    isTerrainRimBlockName,
    type TerrainRimBlockName,
    type TerrainRimSurface,
    terrainRimBlockShapes,
} from './terrainShapes';

/** The ground a rim block's lip continues. */
export function terrainRimSurfaceOf(name: TerrainRimBlockName) {
    return terrainRimBlockShapes[name].surface;
}

/**
 * What shows under the lip. The island is soil all the way round; a built
 * stone block is stone right through, so its rim is a rounded stone edge.
 */
export type TerrainRimBody = 'polishedStone' | 'soil' | 'stone';

export function terrainRimBodyForSurface(
    surface: TerrainRimSurface,
): TerrainRimBody {
    if (surface === 'stone' || surface === 'polishedStone') return surface;
    return 'soil';
}

/** A neighbour must reach this close to the top to hide the side. */
const coveredTolerance = 0.02;
const heightEpsilon = 1e-4;

/**
 * Over open air, lips at least this high above the ground keep their full
 * size; lower down the toe of a slope on the ground leaves no room for one,
 * so the lip and body shrink toward `terrainRimToeLipScale` there.
 */
const fullLipHeight = 0.2;
export const terrainRimToeLipScale = 0.4;

export function terrainRimLipScale(heightAboveGround: number) {
    const share = Math.min(1, Math.max(0, heightAboveGround / fullLipHeight));
    return terrainRimToeLipScale + (1 - terrainRimToeLipScale) * share;
}

/**
 * The size of the lip at a point of a side that stands `height` high beside
 * a neighbour whose top is at `neighbour` there. Beside terrain the lip is
 * never deeper than the side it shows, so it rides on a neighbouring slope
 * and tapers away where that slope reaches the edge, instead of sticking out
 * of it. Beside open air it keeps the size `terrainRimLipScale` gives.
 */
export function terrainRimLipScaleBeside(height: number, neighbour: number) {
    if (!Number.isFinite(neighbour)) return terrainRimLipScale(height);
    const shown = (height - neighbour) / terrainRimDimensions.lipDepth;
    return Math.min(1, Math.max(0, shown));
}

/**
 * Whether a lip shrinks beside lower terrain (`terrainRimLipScaleBeside`).
 * Soil and sand roll their lip away into a neighbouring slope. Stone,
 * polished stone and gravel are hard edges: tapered to a point, their lip
 * read as a horn lying on the slope. They keep the lip at full size and let
 * the neighbour's top hide what reaches into it, so the edge dives into the
 * slope like a kerb.
 */
export function terrainRimLipTapersBeside(surface: TerrainRimSurface) {
    return (
        surface !== 'stone' &&
        surface !== 'polishedStone' &&
        surface !== 'gravel'
    );
}

/** Ends where the lip has shrunk below this need no cap. */
const capLipScale = 0.5;

/**
 * `edge` and `corner` wrap the full-height sides and corners of a flat
 * top. `cap-end` and `cap-start` round off a flat run that stops beside a
 * neighbour without a lip at its height; like a corner they sit on the
 * corner of `turn`, `cap-end` closing the run on side `turn` and `cap-start`
 * the run on the previous side (see `createTerrainRimCapGeometry`).
 *
 * Shaped tops (ramps, corners and stairs) get `strip` pieces that follow
 * their top along a side, with any caps built in, and `shaped-corner`
 * pieces on corners below the top or beside a sloping top. Their geometry
 * is described by `shape` (see `terrainRimGeometry.ts`).
 */
export type TerrainRimPieceKind =
    | 'cap-end'
    | 'cap-start'
    | 'corner'
    | 'edge'
    | 'shaped-corner'
    | 'strip';

export type TerrainRimPlacement<TStack extends GardenStack = GardenStack> = {
    block: Block;
    blockIndex: number;
    /**
     * Whether the piece wears a lip: nothing stands on it, or the terrain
     * block above leaves this edge bare, as the toe of a ramp does.
     */
    hasLip: boolean;
    kind: TerrainRimPieceKind;
    /** The geometry of a `strip` or `shaped-corner` piece. */
    shape?: TerrainRimCornerShape | TerrainRimStripShape;
    /** Names the geometry: the kind, plus the shape of shaped pieces. */
    geometryKey: string;
    stack: TStack;
    /** World height of the block's top surface. */
    top: number;
    turn: number;
};

type Shared<TStack extends GardenStack> = Pick<
    TerrainRimPlacement<TStack>,
    'block' | 'blockIndex' | 'stack' | 'top'
>;

/** One end of a run of lip and body, to tell whether it needs a cap. */
type RunEnd = {
    /** The end's world point, in half tiles. */
    key: string;
    /** 0 at the start of the side, 1 at its end, 0.5 in the middle. */
    t: 0 | 0.5 | 1;
    y: number;
    /**
     * How much of the lip shows there (`terrainRimLipScaleBeside`): an end
     * sunk into a neighbour's top needs no cap.
     */
    k: number;
};

/**
 * How a run ends: open, `cap` (rounded off round the tile edge, like a
 * corner) or `cut` (flush with a flat face, see `TerrainRimStripShape`).
 */
type RunEndClosure = 'cap' | 'cut' | false;

type PendingRun<TStack extends GardenStack> = {
    entry: TerrainColumnBlock;
    hasLip: boolean;
    /** Index in `placements`, to update the strip's caps. */
    placementIndex: number;
    shared: Shared<TStack>;
    side: number;
    ends: [RunEnd, RunEnd];
    ownHeights: TerrainSideProfile;
    neighbourHeights: TerrainSideProfile;
    corners: readonly boolean[];
};

function pointKey(x: number, z: number, side: number, y: number) {
    return `${x}|${z}|${mod4(side)}|${Math.round(y * 1000)}`;
}

/** The world point at `t` along side `side` of the tile at (x, z), doubled. */
function sidePoint(x: number, z: number, side: number, t: 0 | 0.5 | 1) {
    if (t === 0.5) {
        const offset = sideOffsets[mod4(side)];
        return { x: 2 * x + offset.x, z: 2 * z + offset.z };
    }
    const offset = cornerOffset(t === 0 ? side + 1 : side);
    return { x: 2 * x + offset.x, z: 2 * z + offset.z };
}

function round(value: number) {
    return Math.round(value * 1000) / 1000;
}

/**
 * Whether half `half` of a side shows above its neighbour. A block standing
 * on terrain shows no side where its own top is at its base (the toe of a
 * ramp): the block under it carries the lip there.
 */
function isHalfExposed(
    own: TerrainSideProfile,
    neighbour: TerrainSideProfile,
    half: 0 | 1,
    base: number,
    supported: boolean,
) {
    const [a, b] = half === 0 ? [0, 1] : [2, 3];
    if (
        supported &&
        own[a] <= base + heightEpsilon &&
        own[b] <= base + heightEpsilon
    ) {
        return false;
    }
    return (
        own[a] - neighbour[a] > coveredTolerance ||
        own[b] - neighbour[b] > coveredTolerance
    );
}

/** The terrain above leaves this part of the side bare. */
function isBareUnder(
    above: TerrainColumnBlock | undefined,
    side: number,
    from: number,
    to: number,
) {
    if (!above) return true;
    const profile = terrainSideProfile(above.shape, above.rotation, side);
    const indices = from === 0 ? (to === 1 ? [0, 1, 2, 3] : [0, 1]) : [2, 3];
    return indices.every((index) => profile[index] <= heightEpsilon);
}

/** The lip size at a point of a side, from its height and its neighbour's. */
type LipScale = (height: number, neighbour: number) => number;

function stripNodes(
    heights: TerrainSideProfile,
    neighbour: TerrainSideProfile,
    from: 0 | 0.5,
    to: 0.5 | 1,
    top: number,
    lipScale: LipScale,
): TerrainRimStripNode[] {
    const node = (
        t: number,
        height: number,
        beside: number,
    ): TerrainRimStripNode => ({
        t,
        y: round(height - top),
        k: round(lipScale(height, beside)),
    });
    if (from === 0 && to === 0.5) {
        return [
            node(0, heights[0], neighbour[0]),
            node(0.5, heights[1], neighbour[1]),
        ];
    }
    if (from === 0.5) {
        return [
            node(0.5, heights[2], neighbour[2]),
            node(1, heights[3], neighbour[3]),
        ];
    }
    const nodes = [
        node(0, heights[0], neighbour[0]),
        node(0.5, heights[1], Math.min(neighbour[1], neighbour[2])),
        node(1, heights[3], neighbour[3]),
    ];
    const [first, middle, last] = nodes;
    // A straight run with one lip size needs no middle node.
    const straight =
        Math.abs(middle.y - (first.y + last.y) / 2) < heightEpsilon &&
        Math.abs(middle.k - (first.k + last.k) / 2) < heightEpsilon;
    return straight ? [first, last] : nodes;
}

/**
 * Finds the exposed sides and outer corners of every rim block and the
 * pieces that wrap them. A side shows where the block's top stands above
 * the neighbouring column's top along their shared edge, so a flat block
 * beside the low part of a ramp is rimmed and the ramp's own sides follow
 * its slope. Inner corners need no piece: the two pieces that meet there
 * overlap and form the mitre themselves. A run of lip that stops where
 * nothing carries it on gets a cap, so the lip and body never end open.
 */
export function resolveTerrainRimPlacements<TStack extends GardenStack>(
    blockData: BlockData[] | null | undefined,
    stacks: readonly TStack[] | undefined,
): TerrainRimPlacement<TStack>[] {
    if (!blockData || !stacks?.length) return [];
    const columns = createTerrainColumnLookup(blockData, stacks);

    const placements: TerrainRimPlacement<TStack>[] = [];
    const runs: PendingRun<TStack>[] = [];
    /** Lip and body ends by world point, side and height. */
    const ends = new Map<string, { lipped: number; plain: number }>();
    const addEnd = (key: string, hasLip: boolean) => {
        const counts = ends.get(key) ?? { lipped: 0, plain: 0 };
        if (hasLip) counts.lipped += 1;
        else counts.plain += 1;
        ends.set(key, counts);
    };

    for (const stack of stacks) {
        const { x, z } = stack.position;
        const column = columns.columnOf(stack);
        for (const [index, entry] of column.entries()) {
            const { name } = entry.block;
            if (!isTerrainRimBlockName(name)) continue;
            const tapers = terrainRimLipTapersBeside(terrainRimSurfaceOf(name));
            // The size the lip is built at: over open air or on soft
            // ground the size it shows, on hard ground full size beside
            // terrain, sunk into the neighbour's top.
            const lipScale: LipScale = (height, beside) =>
                tapers || !Number.isFinite(beside)
                    ? terrainRimLipScaleBeside(height, beside)
                    : 1;
            const top = entry.base + entry.height;
            const above = column[index + 1];
            const supported = index > 0;
            const shared: Shared<TStack> = {
                block: entry.block,
                blockIndex: entry.blockIndex,
                stack,
                top,
            };
            const bottom = round(
                -(entry.height + terrainRimDimensions.bodyDepth - 0.4),
            );
            const ownHeights = sideOffsets.map((_, side) =>
                terrainBlockSideHeights(entry, side),
            );
            const neighbourHeights = sideOffsets.map((offset, side) =>
                terrainNeighbourSideHeights(
                    columns.columnAt(x + offset.x, z + offset.z),
                    side,
                ),
            );
            const exposed = ownHeights.map((own, side) =>
                ([0, 1] as const).map((half) =>
                    isHalfExposed(
                        own,
                        neighbourHeights[side],
                        half,
                        entry.base,
                        supported,
                    ),
                ),
            );

            // Corner `turn` lies between side `turn` (its end half) and the
            // side before it (its start half). It takes the larger lip of
            // the two sides: where one side's lip tapers into a neighbour,
            // that half of the corner lies inside the neighbour too.
            const cornerScale = (scale: LipScale, corner: number) => {
                const height = ownHeights[corner][3];
                return Math.max(
                    scale(height, neighbourHeights[corner][3]),
                    scale(height, neighbourHeights[mod4(corner - 1)][0]),
                );
            };
            const corners = sideOffsets.map((_, corner) => {
                const height = ownHeights[corner][3];
                if (supported && height <= entry.base + heightEpsilon) {
                    return false;
                }
                return (
                    exposed[corner][1] &&
                    exposed[mod4(corner - 1)][0] &&
                    cornerScale(terrainRimLipScaleBeside, corner) >
                        heightEpsilon
                );
            });
            corners.forEach((isCorner, corner) => {
                if (!isCorner) return;
                const height = ownHeights[corner][3];
                const cornerLipScale = round(cornerScale(lipScale, corner));
                const hasLip =
                    !above ||
                    terrainCornerHeight(above.shape, above.rotation, corner) <=
                        heightEpsilon;
                const gradients = terrainCornerGradients(
                    entry.shape,
                    entry.rotation,
                    corner,
                );
                const level =
                    Math.abs(height - top) < heightEpsilon &&
                    cornerLipScale === 1 &&
                    gradients.every(([gx, gz]) => gx === 0 && gz === 0);
                if (level) {
                    placements.push({
                        ...shared,
                        geometryKey: 'corner',
                        hasLip,
                        kind: 'corner',
                        turn: corner,
                    });
                } else {
                    const shape: TerrainRimCornerShape = {
                        kind: 'corner',
                        bottom,
                        gradients: [
                            [
                                round(gradients[0][0] * entry.height),
                                round(gradients[0][1] * entry.height),
                            ],
                            [
                                round(gradients[1][0] * entry.height),
                                round(gradients[1][1] * entry.height),
                            ],
                        ],
                        k: cornerLipScale,
                        y: round(height - top),
                    };
                    placements.push({
                        ...shared,
                        geometryKey: terrainRimPieceShapeKey(shape),
                        hasLip,
                        kind: 'shaped-corner',
                        shape,
                        turn: corner,
                    });
                }
                const point = sidePoint(x, z, corner, 1);
                addEnd(pointKey(point.x, point.z, corner, height), hasLip);
                addEnd(pointKey(point.x, point.z, corner - 1, height), hasLip);
            });

            ownHeights.forEach((heights, side) => {
                const [first, second] = exposed[side];
                if (!first && !second) return;
                const step = Math.abs(heights[1] - heights[2]) > heightEpsilon;
                const ranges: [0 | 0.5, 0.5 | 1][] =
                    first && second && !step
                        ? [[0, 1]]
                        : [
                              ...(first ? [[0, 0.5] as [0, 0.5]] : []),
                              ...(second ? [[0.5, 1] as [0.5, 1]] : []),
                          ];
                const [tiltOut] = terrainSideGradient(
                    entry.shape,
                    entry.rotation,
                    side,
                );
                const tilt = round(tiltOut * entry.height);
                const nosing = (at: number) =>
                    terrainSideHasNosing(entry.shape, entry.rotation, at);
                // Side `side` starts at corner `side + 1`, which it shares
                // with side `side + 1`, and ends beside side `side - 1`.
                const inset = nosing(side)
                    ? {
                          width: terrainStairNosingWidth,
                          mitreStart: nosing(side + 1),
                          mitreEnd: nosing(side - 1),
                      }
                    : undefined;
                for (const [from, to] of ranges) {
                    const hasLip = isBareUnder(above, side, from, to);
                    const nodes = stripNodes(
                        heights,
                        neighbourHeights[side],
                        from,
                        to,
                        top,
                        lipScale,
                    );
                    const startIndex = from === 0 ? 0 : 2;
                    const endIndex = to === 1 ? 3 : 1;
                    const startY = heights[startIndex];
                    const endY = heights[endIndex];
                    const shownAt = (at: number) =>
                        terrainRimLipScaleBeside(
                            heights[at],
                            neighbourHeights[side][at],
                        );
                    const level =
                        from === 0 &&
                        to === 1 &&
                        tilt === 0 &&
                        nodes.every((node) => node.k === 1) &&
                        heights.every(
                            (height) => Math.abs(height - top) < heightEpsilon,
                        );
                    const placementIndex = placements.length;
                    if (level) {
                        placements.push({
                            ...shared,
                            geometryKey: 'edge',
                            hasLip,
                            kind: 'edge',
                            turn: side,
                        });
                    } else {
                        const shape: TerrainRimStripShape = {
                            kind: 'strip',
                            bottom,
                            capEnd: false,
                            capStart: false,
                            nodes,
                            tilt,
                            ...(inset ? { inset } : {}),
                        };
                        placements.push({
                            ...shared,
                            geometryKey: terrainRimPieceShapeKey(shape),
                            hasLip,
                            kind: 'strip',
                            shape,
                            turn: side,
                        });
                    }
                    const startPoint = sidePoint(x, z, side, from);
                    const endPoint = sidePoint(x, z, side, to);
                    const runEnds: [RunEnd, RunEnd] = [
                        {
                            key: pointKey(
                                startPoint.x,
                                startPoint.z,
                                side,
                                startY,
                            ),
                            t: from,
                            y: startY,
                            k: shownAt(startIndex),
                        },
                        {
                            key: pointKey(endPoint.x, endPoint.z, side, endY),
                            t: to,
                            y: endY,
                            k: shownAt(endIndex),
                        },
                    ];
                    for (const end of runEnds) addEnd(end.key, hasLip);
                    runs.push({
                        corners,
                        ends: runEnds,
                        entry,
                        hasLip,
                        neighbourHeights: neighbourHeights[side],
                        ownHeights: heights,
                        placementIndex,
                        shared,
                        side,
                    });
                }
            });
        }
    }

    // Close each run end that has no corner, no wall and no lip on the
    // neighbour to carry it on.
    const caps: TerrainRimPlacement<TStack>[] = [];
    for (const run of runs) {
        const { x, z } = run.shared.stack.position;
        const capped = run.ends.map((end): RunEndClosure => {
            if (end.k < capLipScale) return false;
            const counts = ends.get(end.key) ?? { lipped: 0, plain: 0 };
            const others = {
                lipped: counts.lipped - (run.hasLip ? 1 : 0),
                plain: counts.plain - (run.hasLip ? 0 : 1),
            };
            if (end.t === 0.5) {
                // A half run: a neighbour beside the other half at least
                // this high walls the end in. Otherwise the block steps
                // there, as stairs do: the upper step's lip ends flush with
                // the riser, and the lower step's curls into the riser's
                // foot, like a run ending beside a taller column.
                const index = run.ends[0].t === 0.5 ? 1 : 2;
                if (run.neighbourHeights[index] >= end.y - coveredTolerance) {
                    return false;
                }
                const other = run.ownHeights[index];
                if (other < end.y - coveredTolerance) return 'cut';
                if (other > end.y + coveredTolerance) return 'cap';
                return false;
            }
            const corner = end.t === 0 ? run.side + 1 : run.side;
            if (run.corners[mod4(corner)]) return false;
            if (others.lipped > 0 || (others.plain > 0 && !run.hasLip)) {
                return false;
            }
            const along =
                sideOffsets[mod4(end.t === 0 ? run.side + 1 : run.side - 1)];
            const out = sideOffsets[mod4(run.side)];
            const diagonal = columns.columnAt(
                x + along.x + out.x,
                z + along.z + out.z,
            );
            const diagonalHeight = terrainColumnCornerHeight(
                diagonal,
                cornerIndexTowards(-(along.x + out.x), -(along.z + out.z)),
            );
            return diagonalHeight < end.y - coveredTolerance ? 'cap' : false;
        });
        const placement = placements[run.placementIndex];
        if (placement.kind === 'strip' && placement.shape?.kind === 'strip') {
            if (!capped[0] && !capped[1]) continue;
            const shape: TerrainRimStripShape = {
                ...placement.shape,
                capEnd: capped[1] === 'cap',
                capStart: capped[0] === 'cap',
                ...(capped[0] === 'cut' ? { cutStart: true } : {}),
                ...(capped[1] === 'cut' ? { cutEnd: true } : {}),
            };
            placements[run.placementIndex] = {
                ...placement,
                geometryKey: terrainRimPieceShapeKey(shape),
                shape,
            };
            continue;
        }
        // Flat runs end on tile corners, where only caps close them.
        if (capped[1] === 'cap') {
            caps.push({
                ...run.shared,
                geometryKey: 'cap-end',
                hasLip: run.hasLip,
                kind: 'cap-end',
                turn: run.side,
            });
        }
        if (capped[0] === 'cap') {
            caps.push({
                ...run.shared,
                geometryKey: 'cap-start',
                hasLip: run.hasLip,
                kind: 'cap-start',
                turn: mod4(run.side + 1),
            });
        }
    }
    return [...placements, ...caps];
}
