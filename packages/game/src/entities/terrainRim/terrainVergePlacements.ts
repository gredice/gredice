import type { BlockData } from '@gredice/client';
import { isWaterBlockName } from '@gredice/js/gardenBlocks';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import { getStackBlockHeight } from '../../utils/stackHeightCore';
import { terrainVergeVariantCount } from './terrainVergeGeometry';

/** The surface that grows over its neighbours. */
const vergeBlockName = 'Block_Grass';
/**
 * Ground the grass bank rolls onto: paths, beds of gravel or stone paving and
 * bare earth. Snow is left out, since grass would not grow over it.
 */
export const terrainVergePathBlockNames: ReadonlySet<string> = new Set([
    'Block_Dry_Ground',
    'Block_Gravel',
    'Block_Ground',
    'Block_Polished_Stone',
    'Block_Sand',
    'Block_Stone',
    'Block_Swamp_Ground',
]);

/** Same side numbering as the terrain rim: 0 is +x, 1 is -z, 2 is -x, 3 is +z. */
const sideOffsets = [
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
] as const;

const levelTolerance = 0.02;

function isSolidTerrain(name: string) {
    return name.startsWith('Block_') && !isWaterBlockName(name);
}

function stackKey(x: number, z: number) {
    return `${x}|${z}`;
}

type TerrainSurface = {
    block: Block;
    blockIndex: number;
    top: number;
};

/** The highest block of the unbroken terrain run at the bottom of a stack. */
function terrainSurface(
    blockData: BlockData[] | null | undefined,
    stack: GardenStack,
): TerrainSurface | null {
    let top = 0;
    let surface: TerrainSurface | null = null;
    for (const [blockIndex, block] of stack.blocks.entries()) {
        if (!isSolidTerrain(block.name)) break;
        top += getStackBlockHeight(blockData, stack, block, blockIndex);
        surface = { block, blockIndex, top };
    }
    return surface;
}

function pickVariant(x: number, z: number, turn: number) {
    const hash = Math.abs(Math.round(x) * 73 + Math.round(z) * 151 + turn * 37);
    return hash % terrainVergeVariantCount;
}

export type TerrainVergePlacement<TStack extends GardenStack = GardenStack> = {
    block: Block;
    blockIndex: number;
    /**
     * `edge` runs along a side that meets a path. `corner` rounds the outside
     * where two such sides meet. `inner` fills this tile's corner when the
     * path only touches it diagonally.
     */
    kind: 'corner' | 'edge' | 'inner';
    stack: TStack;
    /** World height of the lawn the bank rises from. */
    top: number;
    turn: number;
    /** Which edge shape to use. Corners have one shape. */
    variant: number;
    /** Edge ends that meet the outer edge of the island sink away. */
    taperEnd: boolean;
    taperStart: boolean;
};

/**
 * Finds every side where a lawn meets a path at the same height, the outer
 * corners between two such sides, and the corners a path touches diagonally.
 */
export function resolveTerrainVergePlacements<TStack extends GardenStack>(
    blockData: BlockData[] | null | undefined,
    stacks: readonly TStack[] | undefined,
): TerrainVergePlacement<TStack>[] {
    if (!blockData || !stacks?.length) return [];
    const surfaces = new Map<string, TerrainSurface | null>();
    for (const stack of stacks) {
        surfaces.set(
            stackKey(stack.position.x, stack.position.z),
            terrainSurface(blockData, stack),
        );
    }

    const placements: TerrainVergePlacement<TStack>[] = [];
    for (const stack of stacks) {
        const { x, z } = stack.position;
        const surface = surfaces.get(stackKey(x, z));
        if (!surface || surface.block.name !== vergeBlockName) continue;

        const levelSurfaceAt = (offsetX: number, offsetZ: number) => {
            const neighbour = surfaces.get(stackKey(x + offsetX, z + offsetZ));
            return neighbour &&
                Math.abs(neighbour.top - surface.top) < levelTolerance
                ? neighbour.block.name
                : null;
        };
        const sideNames = sideOffsets.map((offset) =>
            levelSurfaceAt(offset.x, offset.z),
        );
        // A side is exposed where no terrain stands at least as high.
        const exposed = sideOffsets.map((offset) => {
            const neighbour = surfaces.get(
                stackKey(x + offset.x, z + offset.z),
            );
            return !neighbour || neighbour.top < surface.top - levelTolerance;
        });
        const meetsPath = sideNames.map(
            (name) => name !== null && terrainVergePathBlockNames.has(name),
        );
        const shared = {
            block: surface.block,
            blockIndex: surface.blockIndex,
            stack,
            top: surface.top,
        };
        meetsPath.forEach((meets, turn) => {
            if (!meets) return;
            // An edge runs from the side after `turn` to the side before it.
            placements.push({
                ...shared,
                kind: 'edge',
                taperEnd: exposed[(turn + 3) % 4],
                taperStart: exposed[(turn + 1) % 4],
                turn,
                variant: pickVariant(x, z, turn),
            });
            // The corner piece of `turn` lies between this side and the
            // previous one.
            if (meetsPath[(turn + 3) % 4]) {
                placements.push({
                    ...shared,
                    kind: 'corner',
                    taperEnd: false,
                    taperStart: false,
                    turn,
                    variant: 0,
                });
            }
        });
        // Corner `turn` lies between side `turn` and the side before it. If
        // both of those neighbours are lawn and the tile beyond the corner is
        // path, their banks end here and this tile closes the gap.
        sideOffsets.forEach((offset, turn) => {
            const previousTurn = (turn + 3) % 4;
            const previous = sideOffsets[previousTurn];
            const diagonal = levelSurfaceAt(
                offset.x + previous.x,
                offset.z + previous.z,
            );
            if (
                diagonal !== null &&
                terrainVergePathBlockNames.has(diagonal) &&
                sideNames[turn] === vergeBlockName &&
                sideNames[previousTurn] === vergeBlockName
            ) {
                placements.push({
                    ...shared,
                    kind: 'inner',
                    taperEnd: false,
                    taperStart: false,
                    turn,
                    variant: 0,
                });
            }
        });
    }
    return placements;
}
