import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import type { ActiveDragPreviewTransform } from '../../dragPreviewIdentity';
import type { GardenStack } from '../../types/Stack';
import {
    createTerrainDragTargetKeys,
    dragPreviewLiftsTerrain,
    removeLiftedTerrainBlocks,
    resolveLiftedTerrainRimPlacements,
    resolveTerrainRimDragPlacements,
    type TerrainRimLiftedPlacement,
} from './terrainRimDragPlacements';
import {
    resolveTerrainRimPlacements,
    type TerrainRimPlacement,
} from './terrainRimPlacements';

const now = '2026-11-26T00:00:00.000Z';

function blockData(name: string, height: number) {
    return {
        id: 1,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: name,
        information: {
            name,
            label: name,
            shortDescription: name,
            fullDescription: name,
        },
        attributes: {
            height,
            nightOnlyPurchase: false,
            stackable: true,
            type: 'terrain',
        },
        prices: { sunflowers: 1 },
        functions: { recycler: false, raisedBed: false },
        createdAt: now,
        updatedAt: now,
    } satisfies BlockData;
}

const blocks = [
    blockData('Block_Grass', 0.4),
    blockData('Block_Ground', 0.4),
    blockData('BirdHouse', 1),
];

function stack(x: number, z: number, ...names: string[]): GardenStack {
    return {
        position: { x, y: 0, z },
        blocks: names.map((name, index) => ({
            id: `${x}:${z}:${index}`,
            name,
            rotation: 0,
        })),
    };
}

function lift(
    relative: { x: number; z: number },
    hoverHeight: number,
    ...targets: { x: number; z: number; blockIndex: number }[]
): ActiveDragPreviewTransform {
    return {
        relative,
        targets: targets.map(({ x, z, blockIndex }) => ({
            blockId: `${x}:${z}:${blockIndex}`,
            blockIndex,
            hoverHeight,
            stackPosition: { x, z },
        })),
    };
}

function describe2(
    placements: (TerrainRimPlacement | TerrainRimLiftedPlacement)[],
) {
    return placements
        .map(
            (placement) =>
                `${placement.stack.position.x},${placement.stack.position.z}#${placement.blockIndex}:${placement.kind}${placement.turn}${placement.hasLip ? '' : '-nolip'}`,
        )
        .sort();
}

// A 2x1 strip of grass with a two-high column (ground under grass) beside it.
const garden = [
    stack(0, 0, 'Block_Grass'),
    stack(1, 0, 'Block_Grass'),
    stack(2, 0, 'Block_Ground', 'Block_Grass'),
];

describe('terrain rim while a drag lifts blocks', () => {
    it('keeps the plain rim when nothing is lifted', () => {
        const result = resolveTerrainRimDragPlacements(blocks, garden, null);
        assert.deepEqual(result.lifted, []);
        assert.deepEqual(
            describe2(result.resting),
            describe2(resolveTerrainRimPlacements(blocks, garden)),
        );
    });

    it('rims a lifted block all round and carries it with the drag', () => {
        const preview = lift({ x: 0, z: 3 }, 0, { x: 0, z: 0, blockIndex: 0 });
        const { lifted } = resolveTerrainRimDragPlacements(
            blocks,
            garden,
            preview,
        );

        assert.deepEqual(describe2(lifted), [
            '0,0#0:corner0',
            '0,0#0:corner1',
            '0,0#0:corner2',
            '0,0#0:corner3',
            '0,0#0:edge0',
            '0,0#0:edge1',
            '0,0#0:edge2',
            '0,0#0:edge3',
        ]);
        for (const placement of lifted) {
            // The source stack and block, so the piece follows the block.
            assert.equal(placement.stack, garden[0]);
            assert.equal(placement.block, garden[0]?.blocks[0]);
            assert.equal(placement.top, 0.4);
            assert.deepEqual(placement.offset, { x: 0, y: 0.1, z: 3 });
        }
    });

    it('walls the hole a lifted block leaves instead of keeping its rim', () => {
        const preview = lift({ x: 0, z: 3 }, 0, { x: 1, z: 0, blockIndex: 0 });
        const { resting } = resolveTerrainRimDragPlacements(
            blocks,
            garden,
            preview,
        );
        const described = describe2(resting);

        // Nothing of the lifted block stays behind.
        assert.equal(
            described.some((entry) => entry.startsWith('1,0#')),
            false,
        );
        // Its neighbours now show the sides that faced it.
        assert.ok(described.includes('0,0#0:edge0'));
        assert.ok(described.includes('2,0#1:edge2'));
        assert.ok(described.includes('2,0#0:edge2-nolip'));
        // Untouched stacks keep their identity.
        assert.equal(
            resting.find((placement) => placement.stack.position.x === 0)
                ?.stack,
            garden[0],
        );
    });

    it('lifts the top of a column with its lip and leaves a lip on what is left', () => {
        const preview = lift({ x: 0, z: 2 }, -0.4, {
            x: 2,
            z: 0,
            blockIndex: 1,
        });
        const { lifted, resting } = resolveTerrainRimDragPlacements(
            blocks,
            garden,
            preview,
        );

        assert.ok(lifted.length > 0);
        for (const placement of lifted) {
            assert.equal(placement.blockIndex, 1);
            assert.equal(placement.hasLip, true);
            // Rests on the ground block below, 0.8 up.
            assert.ok(Math.abs(placement.top - 0.8) < 1e-9);
            assert.ok(Math.abs(placement.offset.y - -0.3) < 1e-9);
        }
        // The ground block it stood on is now the top and grows a lip.
        const ground = resting.filter(
            (placement) =>
                placement.stack.position.x === 2 && placement.blockIndex === 0,
        );
        assert.ok(ground.length > 0);
        assert.ok(ground.every((placement) => placement.hasLip));
        assert.ok(ground.every((placement) => placement.stack === garden[2]));
    });

    it('rims blocks lifted together as one island', () => {
        const preview = lift(
            { x: 0, z: 3 },
            0,
            { x: 0, z: 0, blockIndex: 0 },
            { x: 1, z: 0, blockIndex: 0 },
        );
        const lifted = resolveLiftedTerrainRimPlacements(
            blocks,
            garden,
            preview,
        );

        // The shared side between the two lifted blocks gets no rim.
        assert.equal(
            describe2(lifted).some(
                (entry) =>
                    entry.startsWith('0,0#0:edge0') ||
                    entry.startsWith('1,0#0:edge2'),
            ),
            false,
        );
        assert.equal(
            lifted.filter((placement) => placement.kind === 'edge').length,
            6,
        );
    });

    it('ignores targets that no longer match a block', () => {
        const stale = lift({ x: 1, z: 0 }, 0, { x: 5, z: 5, blockIndex: 0 });
        const result = resolveTerrainRimDragPlacements(blocks, garden, stale);
        assert.deepEqual(result.lifted, []);
        assert.deepEqual(
            describe2(result.resting),
            describe2(resolveTerrainRimPlacements(blocks, garden)),
        );
    });
});

describe('telling whether a drag lifts terrain', () => {
    const withProp = [stack(0, 0, 'Block_Grass', 'BirdHouse')];
    const keys = createTerrainDragTargetKeys(withProp);

    it('matches a lifted terrain block', () => {
        assert.equal(
            dragPreviewLiftsTerrain(
                lift({ x: 1, z: 0 }, 0, { x: 0, z: 0, blockIndex: 0 }),
                keys,
            ),
            true,
        );
    });

    it('ignores a lifted prop and an empty drag', () => {
        assert.equal(
            dragPreviewLiftsTerrain(
                lift({ x: 1, z: 0 }, 0, { x: 0, z: 0, blockIndex: 1 }),
                keys,
            ),
            false,
        );
        assert.equal(dragPreviewLiftsTerrain(null, keys), false);
    });
});

describe('the garden without its lifted blocks', () => {
    it('returns the same stacks when nothing is lifted', () => {
        assert.equal(removeLiftedTerrainBlocks(garden, null), garden);
    });

    it('takes the lifted blocks out and keeps other stacks', () => {
        const resting = removeLiftedTerrainBlocks(
            garden,
            lift({ x: 0, z: 2 }, 0, { x: 2, z: 0, blockIndex: 1 }),
        );
        assert.equal(resting?.[0], garden[0]);
        assert.deepEqual(
            resting?.[2]?.blocks.map((block) => block.name),
            ['Block_Ground'],
        );
        // The source stack itself is left alone.
        assert.equal(garden[2]?.blocks.length, 2);
    });
});
