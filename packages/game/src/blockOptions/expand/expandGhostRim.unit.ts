import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import { resolveTerrainRimPlacements } from '../../entities/terrainRim/terrainRimPlacements';
import { sideOffsets } from '../../entities/terrainRim/terrainShapes';
import type { GardenStack } from '../../types/Stack';
import {
    countExpandGhostRimInstances,
    getExpandGhostBlockId,
    getExpandGhostRimCapacity,
    resolveExpandGhostRimPlacements,
} from './expandGhostRim';
import type { ExpandCell } from './expandPointer';

const now = '2026-11-27T00:00:00.000Z';

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
    blockData('Block_Grass_Angle', 0.4),
    blockData('Block_Sand', 0.4),
    blockData('Tree', 1.6),
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

function row(fromX: number, toX: number, z: number): ExpandCell[] {
    const cells: ExpandCell[] = [];
    for (let x = fromX; x <= toX; x++) cells.push({ x, z });
    return cells;
}

function resolve(
    cells: ExpandCell[],
    stacks: GardenStack[] = [],
    blockName = 'Block_Grass',
    rotation = 0,
) {
    return resolveExpandGhostRimPlacements({
        blockData: blocks,
        blockName,
        cells,
        rotation,
        stacks,
    });
}

/** `x,z:kind+turn` of each piece, sorted. */
function describePieces(placements: ReturnType<typeof resolve>) {
    return placements
        .map(
            ({ kind, stack: { position }, turn }) =>
                `${position.x},${position.z}:${kind}${turn}`,
        )
        .sort();
}

describe('Expand ghost rim', () => {
    it('rims a row of copies as one strip, not as separate tiles', () => {
        const cells = row(0, 2, 0);
        const merged = resolve(cells);
        const alone = cells.flatMap((cell) => resolve([cell]));

        // Each copy alone wears four edges and four corners.
        assert.equal(alone.length, 24);
        // Together: two long sides of three edges, two ends, four corners.
        assert.equal(merged.length, 12);
        assert.equal(
            merged.filter((piece) => piece.kind === 'corner').length,
            4,
        );
        // No edge stands on a side two copies share.
        const copies = new Set(cells.map(({ x, z }) => `${x}|${z}`));
        for (const piece of merged) {
            if (piece.kind !== 'edge') continue;
            const { x, z } = piece.stack.position;
            const out = sideOffsets[piece.turn];
            assert.ok(out);
            assert.ok(
                !copies.has(`${x + out.x}|${z + out.z}`),
                `edge ${piece.turn} of (${x}, ${z}) faces a copy`,
            );
        }
    });

    it('merges with the source and level terrain beside the copies', () => {
        // The source at (−1, 0); copies at (0, 0) and (1, 0).
        const garden = [stack(-1, 0, 'Block_Grass')];
        const pieces = resolve(row(0, 1, 0), garden);
        const lone = resolve(row(0, 1, 0));

        assert.ok(pieces.length < lone.length);
        // Only the copies' own pieces are returned, never the source's.
        for (const piece of pieces) {
            assert.match(piece.block.id, /^block-expand-ghost:/);
        }
        // The copy beside the source has no lip or corner on that side.
        assert.deepEqual(
            describePieces(pieces).filter((piece) => piece.startsWith('0,0:')),
            ['0,0:edge1', '0,0:edge3'],
        );
        // It matches the garden rim the placed copies will wear.
        const placed = [
            ...garden,
            stack(0, 0, 'Block_Grass'),
            stack(1, 0, 'Block_Grass'),
        ];
        assert.equal(
            pieces.length,
            resolveTerrainRimPlacements(blocks, placed).filter(
                (piece) => piece.stack.position.x >= 0,
            ).length,
        );
    });

    it('draws no rim when the copies fill a hole in level terrain', () => {
        const garden: GardenStack[] = [];
        for (let x = -1; x <= 3; x++) {
            for (let z = -1; z <= 2; z++) {
                const inHole = x >= 0 && x <= 2 && z >= 0 && z <= 1;
                if (!inHole) garden.push(stack(x, z, 'Block_Grass'));
            }
        }
        assert.deepEqual(
            resolve([...row(0, 2, 0), ...row(0, 2, 1)], garden),
            [],
        );
    });

    it('wears the full rim where the copies stand above lower ground', () => {
        const pieces = resolve([{ x: 0, z: 0 }], [stack(5, 5, 'Block_Grass')]);
        assert.deepEqual(describePieces(pieces), [
            '0,0:corner0',
            '0,0:corner1',
            '0,0:corner2',
            '0,0:corner3',
            '0,0:edge0',
            '0,0:edge1',
            '0,0:edge2',
            '0,0:edge3',
        ]);
    });

    it('puts a copy on top of its cell stack', () => {
        // A sand copy on a cell that already holds grass stands 0.4 higher.
        const pieces = resolve(
            [{ x: 0, z: 0 }],
            [stack(0, 0, 'Block_Grass')],
            'Block_Sand',
        );
        assert.ok(pieces.length > 0);
        for (const piece of pieces) {
            assert.equal(piece.block.name, 'Block_Sand');
            assert.equal(piece.blockIndex, 1);
            assert.ok(Math.abs(piece.top - 0.8) < 1e-6);
        }
    });

    it('turns shaped copies with the source and keeps ids per cell', () => {
        const pieces = resolve(row(0, 1, 0), [], 'Block_Grass_Angle', 1);
        assert.ok(pieces.length > 0);
        const ids = new Set(pieces.map((piece) => piece.block.id));
        assert.deepEqual(
            [...ids].sort(),
            [
                getExpandGhostBlockId({ x: 0, z: 0 }),
                getExpandGhostBlockId({ x: 1, z: 0 }),
            ].sort(),
        );
        for (const piece of pieces) {
            assert.equal(piece.block.rotation, 1);
        }
    });

    it('ignores garden stacks beyond the neighbourhood', () => {
        const near = resolve(row(0, 1, 0));
        const far = resolve(row(0, 1, 0), [
            stack(6, 0, 'Block_Grass'),
            stack(-5, 3, 'Block_Grass'),
        ]);
        assert.deepEqual(describePieces(far), describePieces(near));
    });

    it('returns nothing for blocks without a rim', () => {
        assert.deepEqual(resolve(row(0, 2, 0), [], 'Tree'), []);
        assert.deepEqual(resolve([]), []);
        assert.deepEqual(
            resolveExpandGhostRimPlacements({
                blockData: null,
                blockName: 'Block_Grass',
                cells: row(0, 1, 0),
                rotation: 0,
                stacks: [],
            }),
            [],
        );
    });

    it('counts a body for every piece and a lip for lipped ones', () => {
        const pieces = resolve(row(0, 2, 0));
        const lips = pieces.filter((piece) => piece.hasLip).length;
        assert.equal(
            countExpandGhostRimInstances(pieces),
            pieces.length + lips,
        );
        assert.equal(countExpandGhostRimInstances([]), 0);
    });

    it('grows the rim instance buffer in powers of two', () => {
        assert.equal(getExpandGhostRimCapacity(0), 16);
        assert.equal(getExpandGhostRimCapacity(16), 16);
        assert.equal(getExpandGhostRimCapacity(17), 32);
        assert.equal(getExpandGhostRimCapacity(200), 256);
    });
});
