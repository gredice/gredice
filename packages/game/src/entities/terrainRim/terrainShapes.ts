import type { BlockData } from '@gredice/client';
import { isWaterBlockName } from '@gredice/js/gardenBlocks';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import { getStackBlockHeight } from '../../utils/stackHeightCore';
import type { GroundPatchSurface } from '../helpers/groundPatchMaterial';

/**
 * The ground a rim lip continues. Soil-like surfaces share the patched ground
 * materials; gravel and the two stones reuse their block's own material.
 */
export type TerrainRimSurface =
    | Exclude<GroundPatchSurface, 'raisedBedSoil'>
    | 'gravel'
    | 'polishedStone'
    | 'stone';

/**
 * The top of a terrain block. Ramps (`angle`), outer and inner corners and
 * stairs keep their GLB, and the rim follows the shape of their top.
 */
export type TerrainShape =
    | 'angle'
    | 'corner'
    | 'flat'
    | 'reverseCorner'
    | 'stairs'
    | 'stairsCorner';

/** Every terrain block that wears a rim, with its ground and shape. */
export const terrainRimBlockShapes = {
    Block_Dry_Ground: { surface: 'dryDirt', shape: 'flat' },
    Block_Dry_Ground_Angle: { surface: 'dryDirt', shape: 'angle' },
    Block_Dry_Ground_Corner: { surface: 'dryDirt', shape: 'corner' },
    Block_Dry_Ground_Reverse_Corner: {
        surface: 'dryDirt',
        shape: 'reverseCorner',
    },
    Block_Grass: { surface: 'grass', shape: 'flat' },
    Block_Grass_Angle: { surface: 'grass', shape: 'angle' },
    Block_Grass_Corner: { surface: 'grass', shape: 'corner' },
    Block_Grass_Reverse_Corner: { surface: 'grass', shape: 'reverseCorner' },
    Block_Gravel: { surface: 'gravel', shape: 'flat' },
    Block_Gravel_Angle: { surface: 'gravel', shape: 'angle' },
    Block_Ground: { surface: 'dirt', shape: 'flat' },
    Block_Ground_Angle: { surface: 'dirt', shape: 'angle' },
    Block_Ground_Corner: { surface: 'dirt', shape: 'corner' },
    Block_Ground_Reverse_Corner: { surface: 'dirt', shape: 'reverseCorner' },
    Block_Polished_Stone: { surface: 'polishedStone', shape: 'flat' },
    Block_Polished_Stone_Angle: { surface: 'polishedStone', shape: 'angle' },
    Block_Polished_Stone_Stairs: {
        surface: 'polishedStone',
        shape: 'stairs',
    },
    Block_Polished_Stone_Stairs_Corner: {
        surface: 'polishedStone',
        shape: 'stairsCorner',
    },
    Block_Sand: { surface: 'sand', shape: 'flat' },
    Block_Sand_Angle: { surface: 'sand', shape: 'angle' },
    Block_Sand_Corner: { surface: 'sand', shape: 'corner' },
    Block_Sand_Reverse_Corner: { surface: 'sand', shape: 'reverseCorner' },
    Block_Snow: { surface: 'snow', shape: 'flat' },
    Block_Snow_Angle: { surface: 'snow', shape: 'angle' },
    Block_Snow_Corner: { surface: 'snow', shape: 'corner' },
    Block_Snow_Reverse_Corner: { surface: 'snow', shape: 'reverseCorner' },
    Block_Stone: { surface: 'stone', shape: 'flat' },
    Block_Stone_Angle: { surface: 'stone', shape: 'angle' },
    Block_Stone_Stairs: { surface: 'stone', shape: 'stairs' },
    Block_Stone_Stairs_Corner: { surface: 'stone', shape: 'stairsCorner' },
    // The legacy name draws the corner stairs (`terrainStairs.ts`).
    Block_Stone_Stairs_Half: { surface: 'stone', shape: 'stairsCorner' },
    Block_Swamp_Ground: { surface: 'swampDirt', shape: 'flat' },
    Block_Swamp_Ground_Angle: { surface: 'swampDirt', shape: 'angle' },
} as const satisfies Record<
    string,
    { surface: TerrainRimSurface; shape: TerrainShape }
>;

export type TerrainRimBlockName = keyof typeof terrainRimBlockShapes;

export function isTerrainRimBlockName(
    name: string,
): name is TerrainRimBlockName {
    return name in terrainRimBlockShapes;
}

/**
 * Height of a block's top along one side, as a share of the block height,
 * at the side's start, just before and just after its middle, and at its
 * end. Side `s` runs from corner `s + 1` to corner `s` (see `sideOffsets`),
 * the direction a rim edge piece sweeps; the top is straight between these
 * points, and a stair step jumps at the middle.
 */
export type TerrainSideProfile = readonly [number, number, number, number];

type ShapeDefinition = {
    /** Profile of each side in the block's own frame (rotation 0). */
    sides: readonly [
        TerrainSideProfile,
        TerrainSideProfile,
        TerrainSideProfile,
        TerrainSideProfile,
    ];
    /**
     * How the top surface next to each side rises across the tile, in block
     * heights per tile along x and z. Ramps and corners are planar facets.
     */
    gradients: readonly [
        readonly [number, number],
        readonly [number, number],
        readonly [number, number],
        readonly [number, number],
    ];
    /**
     * Sides whose top edge the GLB rounds off itself: the front of the
     * stairs' lower step, where `assets/scripts/party-pass-terrain.py`
     * rounds the nosings that face down.
     */
    nosings?: readonly number[];
};

/**
 * How far in from the tile edge a stair nosing starts to round down. A lip
 * on that side covers it, or a groove shows between the two.
 */
export const terrainStairNosingWidth = 0.05;

const full: TerrainSideProfile = [1, 1, 1, 1];
const none: TerrainSideProfile = [0, 0, 0, 0];
const half: TerrainSideProfile = [0.5, 0.5, 0.5, 0.5];
const rise: TerrainSideProfile = [0, 0.5, 0.5, 1];
const fall: TerrainSideProfile = [1, 0.5, 0.5, 0];
const stepUp: TerrainSideProfile = [0.5, 0.5, 1, 1];
const stepDown: TerrainSideProfile = [1, 1, 0.5, 0.5];
const level = [0, 0] as const;
const upX = [1, 0] as const;
const downZ = [0, -1] as const;

/**
 * The GLB tops at rotation 0 (`BlockSandAngle`, `BlockTerrainCorner`,
 * `BlockTerrainReverseCorner`, `BlockStoneStairs*`): the ramp rises to +x;
 * the outer corner peaks at +x/-z; the inner corner dips at -x/+z; the
 * stairs' upper step is the +x half, the corner stairs' the +x/-z quarter.
 */
const shapeDefinitions: Record<TerrainShape, ShapeDefinition> = {
    angle: {
        sides: [full, rise, none, fall],
        gradients: [upX, upX, upX, upX],
    },
    corner: {
        sides: [fall, rise, none, none],
        gradients: [downZ, upX, upX, downZ],
    },
    flat: {
        sides: [full, full, full, full],
        gradients: [level, level, level, level],
    },
    reverseCorner: {
        sides: [full, full, rise, fall],
        gradients: [upX, downZ, downZ, upX],
    },
    stairs: {
        sides: [full, stepUp, half, stepDown],
        gradients: [level, level, level, level],
        nosings: [2],
    },
    stairsCorner: {
        sides: [stepDown, stepUp, half, half],
        gradients: [level, level, level, level],
        nosings: [2, 3],
    },
};

/**
 * Side `turn` faces +x after `turn` quarter turns around y, matching how
 * block instances apply their rotation: 0 is +x, 1 is -z, 2 is -x, 3 is +z.
 * Corner `turn` lies between side `turn` and the side before it: 0 is
 * +x/+z, 1 is +x/-z, 2 is -x/-z, 3 is -x/+z.
 */
export const sideOffsets = [
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
] as const;

export function cornerOffset(corner: number) {
    const side = sideOffsets[mod4(corner)];
    const previous = sideOffsets[mod4(corner + 3)];
    return { x: side.x + previous.x, z: side.z + previous.z };
}

/** The side that faces (x, z), one of the four unit directions. */
export function sideIndexTowards(x: number, z: number) {
    const side = sideOffsets.findIndex(
        (offset) => offset.x === Math.sign(x) && offset.z === Math.sign(z),
    );
    return Math.max(0, side);
}

/** The corner in direction (x, z), both of them ±1. */
export function cornerIndexTowards(x: number, z: number) {
    for (let corner = 0; corner < 4; corner++) {
        const offset = cornerOffset(corner);
        if (offset.x === Math.sign(x) && offset.z === Math.sign(z)) {
            return corner;
        }
    }
    return 0;
}

export function mod4(value: number) {
    return ((Math.round(value) % 4) + 4) % 4;
}

/** Turns an (x, z) vector by quarter turns, the way block rotation does. */
export function rotateQuarter(
    [x, z]: readonly [number, number],
    turns: number,
): [number, number] {
    let vector: [number, number] = [x, z];
    for (let turn = 0; turn < mod4(turns); turn++) {
        vector = [vector[1], -vector[0]];
    }
    return [vector[0] === 0 ? 0 : vector[0], vector[1] === 0 ? 0 : vector[1]];
}

export function terrainShapeOf(name: string): TerrainShape {
    return isTerrainRimBlockName(name)
        ? terrainRimBlockShapes[name].shape
        : 'flat';
}

/** The profile of world side `side` of a shape turned by `rotation`. */
export function terrainSideProfile(
    shape: TerrainShape,
    rotation: number,
    side: number,
): TerrainSideProfile {
    return shapeDefinitions[shape].sides[mod4(side - rotation)];
}

/** Whether the GLB rounds off the top edge of world side `side` itself. */
export function terrainSideHasNosing(
    shape: TerrainShape,
    rotation: number,
    side: number,
) {
    return (
        shapeDefinitions[shape].nosings?.includes(mod4(side - rotation)) ??
        false
    );
}

/**
 * Where the gaps between a stone block's paving slabs reach its tile sides.
 * The stone GLBs pave their top with separate slabs, each rounded off along
 * the edges it shares with another, so a groove runs between them right out
 * to the tile side. The rim's lip dips with it there
 * (`TerrainRimStripNode.d`), so the groove runs on through the edge.
 */
export type TerrainSlabGrooves = {
    /** How far each slab's edge rounds down into a groove, and across. */
    radius: number;
    /** Half the width of the flat floor between two slabs. */
    floor: number;
    /** Groove centres along each side (`t`), in the block's own frame. */
    sides: readonly [
        readonly number[],
        readonly number[],
        readonly number[],
        readonly number[],
    ];
};

/** The groove centres of a side's slabs, and their shape. */
export type TerrainSideGrooves = Pick<
    TerrainSlabGrooves,
    'floor' | 'radius'
> & {
    at: readonly number[];
};

const quarterGrooves = [0.25, 0.75] as const;
const middleGroove = [0.5] as const;
/** Nine slabs, 0.016 apart, rounded over 0.03 (`BlockStone`). */
const stonePavingGrooves = {
    radius: 0.03,
    floor: 0.008,
    sides: [quarterGrooves, quarterGrooves, quarterGrooves, quarterGrooves],
} as const satisfies TerrainSlabGrooves;
/**
 * The stairs pave each step with two slabs that meet in the middle, rounded
 * over 0.045 (`BlockStoneStairs*`). Grooves cross the full and half sides;
 * on a stepped side the riser stands where the groove would.
 */
const stoneStairsGrooves = {
    radius: 0.045,
    floor: 0,
    sides: [middleGroove, [], middleGroove, []],
} as const satisfies TerrainSlabGrooves;
const stoneCornerStairsGrooves = {
    ...stoneStairsGrooves,
    sides: [[], [], middleGroove, middleGroove],
} as const satisfies TerrainSlabGrooves;

const terrainSlabGrooves: Partial<
    Record<TerrainRimBlockName, TerrainSlabGrooves>
> = {
    Block_Stone: stonePavingGrooves,
    // The ramp's slabs follow its slope; its toe meets the ground flat.
    Block_Stone_Angle: {
        ...stonePavingGrooves,
        sides: [quarterGrooves, quarterGrooves, [], quarterGrooves],
    },
    Block_Stone_Stairs: stoneStairsGrooves,
    Block_Stone_Stairs_Corner: stoneCornerStairsGrooves,
    Block_Stone_Stairs_Half: stoneCornerStairsGrooves,
};

/** The slab grooves that reach world side `side` of a block, if any. */
export function terrainSideGrooves(
    name: TerrainRimBlockName,
    rotation: number,
    side: number,
): TerrainSideGrooves | undefined {
    const grooves = terrainSlabGrooves[name];
    const at = grooves?.sides[mod4(side - rotation)];
    if (!grooves || !at?.length) return undefined;
    return { at, floor: grooves.floor, radius: grooves.radius };
}

/** Height share of world corner `corner` of a shape turned by `rotation`. */
export function terrainCornerHeight(
    shape: TerrainShape,
    rotation: number,
    corner: number,
) {
    // Side `corner` ends at corner `corner`.
    return terrainSideProfile(shape, rotation, corner)[3];
}

/**
 * The rise of the top next to world side `side`, in the frame of a rim
 * piece on that side (+x out, +z along the side): `[out, along]`, in block
 * heights per tile. The frame depends only on the shape's own side.
 */
export function terrainSideGradient(
    shape: TerrainShape,
    rotation: number,
    side: number,
): [number, number] {
    const localSide = mod4(side - rotation);
    return rotateQuarter(
        shapeDefinitions[shape].gradients[localSide],
        -localSide,
    );
}

/**
 * The rise of the top next to the two sides that meet at world corner
 * `corner`, in the frame of a rim corner piece there (the corner at +x/+z,
 * side `corner` facing +x and the side before it facing +z).
 */
export function terrainCornerGradients(
    shape: TerrainShape,
    rotation: number,
    corner: number,
): [[number, number], [number, number]] {
    const localCorner = mod4(corner - rotation);
    const { gradients } = shapeDefinitions[shape];
    return [
        rotateQuarter(gradients[localCorner], -localCorner),
        rotateQuarter(gradients[mod4(localCorner - 1)], -localCorner),
    ];
}

export function isSolidTerrainBlockName(name: string) {
    return name.startsWith('Block_') && !isWaterBlockName(name);
}

/** One block of the unbroken run of terrain at the bottom of a stack. */
export type TerrainColumnBlock = {
    block: Block;
    blockIndex: number;
    base: number;
    height: number;
    shape: TerrainShape;
    rotation: number;
};

/** The unbroken run of terrain blocks at the bottom of a stack. */
export function resolveTerrainColumn(
    blockData: BlockData[] | null | undefined,
    stack: GardenStack,
): TerrainColumnBlock[] {
    const column: TerrainColumnBlock[] = [];
    let base = 0;
    for (const [blockIndex, block] of stack.blocks.entries()) {
        if (!isSolidTerrainBlockName(block.name)) break;
        const height = getStackBlockHeight(blockData, stack, block, blockIndex);
        column.push({
            block,
            blockIndex,
            base,
            height,
            shape: terrainShapeOf(block.name),
            rotation: block.rotation || 0,
        });
        base += height;
    }
    return column;
}

/** World heights of a block's top along world side `side`. */
export function terrainBlockSideHeights(
    entry: TerrainColumnBlock,
    side: number,
): TerrainSideProfile {
    const profile = terrainSideProfile(entry.shape, entry.rotation, side);
    return [
        entry.base + entry.height * profile[0],
        entry.base + entry.height * profile[1],
        entry.base + entry.height * profile[2],
        entry.base + entry.height * profile[3],
    ];
}

const noColumn: TerrainSideProfile = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
];

/**
 * World heights of a column's top along world side `side`, from the
 * column's own frame. A missing or empty column is no ground at all.
 */
export function terrainColumnSideHeights(
    column: readonly TerrainColumnBlock[] | undefined,
    side: number,
): TerrainSideProfile {
    const top = column?.[column.length - 1];
    return top ? terrainBlockSideHeights(top, side) : noColumn;
}

/**
 * World heights of a neighbour's top along the side it shares with a block,
 * in the block's direction for its side `side`: the neighbour's side
 * `side + 2`, run backwards.
 */
export function terrainNeighbourSideHeights(
    neighbour: readonly TerrainColumnBlock[] | undefined,
    side: number,
): TerrainSideProfile {
    const [a, b, c, d] = terrainColumnSideHeights(neighbour, side + 2);
    return [d, c, b, a];
}

/** World height of a column's top at its world corner `corner`. */
export function terrainColumnCornerHeight(
    column: readonly TerrainColumnBlock[] | undefined,
    corner: number,
) {
    const top = column?.[column.length - 1];
    if (!top) return Number.NEGATIVE_INFINITY;
    return (
        top.base +
        top.height * terrainCornerHeight(top.shape, top.rotation, corner)
    );
}

/** Looks columns up by position, resolving each stack once. */
export function createTerrainColumnLookup<TStack extends GardenStack>(
    blockData: BlockData[] | null | undefined,
    stacks: readonly TStack[],
) {
    const stackByPosition = new Map<string, TStack>();
    for (const stack of stacks) {
        stackByPosition.set(`${stack.position.x}|${stack.position.z}`, stack);
    }
    const columns = new Map<GardenStack, TerrainColumnBlock[]>();
    const columnOf = (stack: TStack) => {
        let column = columns.get(stack);
        if (!column) {
            column = resolveTerrainColumn(blockData, stack);
            columns.set(stack, column);
        }
        return column;
    };
    return {
        columnOf,
        columnAt(x: number, z: number) {
            const stack = stackByPosition.get(`${x}|${z}`);
            return stack ? columnOf(stack) : undefined;
        },
    };
}
