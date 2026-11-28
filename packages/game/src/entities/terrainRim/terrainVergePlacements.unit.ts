import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import type { GardenStack } from '../../types/Stack';
import { terrainVergeVariantCount } from './terrainVergeGeometry';
import { resolveTerrainVergePlacements } from './terrainVergePlacements';

const now = '2026-11-22T00:00:00.000Z';

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
    blockData('Block_Gravel', 0.4),
    blockData('Block_Stone', 0.4),
    blockData('Block_Snow', 0.4),
    blockData('Raised_Bed', 0.3),
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

function describePlacements(stacks: GardenStack[]) {
    return resolveTerrainVergePlacements(blocks, stacks)
        .map(
            ({ kind, stack: { position }, turn }) =>
                `${position.x},${position.z}:${kind}${turn}`,
        )
        .sort();
}

describe('terrain verge placements', () => {
    it('banks the lawn on the side that faces a path', () => {
        // Turn 0 faces +x. Only the grass grows a bank, never the path.
        assert.deepEqual(
            describePlacements([
                stack(0, 0, 'Block_Grass'),
                stack(1, 0, 'Block_Ground'),
            ]),
            ['0,0:edge0'],
        );
    });

    it('banks the lawn onto gravel and paving, but not onto snow', () => {
        assert.deepEqual(
            describePlacements([
                stack(0, 0, 'Block_Grass'),
                stack(1, 0, 'Block_Gravel'),
                stack(0, 1, 'Block_Stone'),
                stack(-1, 0, 'Block_Snow'),
            ]),
            ['0,0:corner0', '0,0:edge0', '0,0:edge3'],
        );
    });

    it('rounds the outer corner where a path wraps around the lawn', () => {
        const placements = describePlacements([
            stack(0, 0, 'Block_Grass'),
            stack(1, 0, 'Block_Ground'),
            stack(0, 1, 'Block_Ground'),
        ]);

        // Sides 0 (+x) and 3 (+z) both meet the path; corner 0 joins them.
        assert.deepEqual(placements, ['0,0:corner0', '0,0:edge0', '0,0:edge3']);
    });

    it('ignores paths at another height and lawn under other terrain', () => {
        assert.deepEqual(
            describePlacements([
                // The lawn sits one block higher than the path beside it.
                stack(0, 0, 'Block_Ground', 'Block_Grass'),
                stack(1, 0, 'Block_Ground'),
                // This lawn is buried: the surface at that height is soil.
                stack(5, 5, 'Block_Grass', 'Block_Ground'),
                stack(6, 5, 'Block_Ground', 'Block_Ground'),
            ]),
            [],
        );
    });

    it('fills the corner of a lawn tile the path touches diagonally', () => {
        const placements = describePlacements([
            stack(0, 0, 'Block_Grass'),
            stack(1, 0, 'Block_Grass'),
            stack(0, 1, 'Block_Grass'),
            stack(1, 1, 'Block_Ground'),
        ]);

        // Corner 0 is the +x/+z corner, the one that points at the path.
        assert.deepEqual(placements, ['0,0:inner0', '0,1:edge0', '1,0:edge3']);
    });

    it('sinks a bank end that reaches the edge of the island', () => {
        // A two-tile strip: lawn at x = 0, path at x = 1, both on the edge
        // of the island at z = 0 and z = 1.
        const placements = resolveTerrainVergePlacements(blocks, [
            stack(0, 0, 'Block_Grass'),
            stack(1, 0, 'Block_Ground'),
            stack(0, 1, 'Block_Grass'),
            stack(1, 1, 'Block_Ground'),
        ]).map(({ kind, stack: { position }, taperEnd, taperStart, turn }) => ({
            at: `${position.x},${position.z}:${kind}${turn}`,
            taperEnd,
            taperStart,
        }));

        // Edge 0 runs from -z (its start) to +z (its end).
        assert.deepEqual(
            placements.sort((left, right) => left.at.localeCompare(right.at)),
            [
                { at: '0,0:edge0', taperEnd: false, taperStart: true },
                { at: '0,1:edge0', taperEnd: true, taperStart: false },
            ],
        );
    });

    it('still banks a lawn that carries a raised bed', () => {
        assert.deepEqual(
            describePlacements([
                stack(0, 0, 'Block_Grass', 'Raised_Bed'),
                stack(1, 0, 'Block_Ground'),
            ]),
            ['0,0:edge0'],
        );
    });

    it('picks a stable edge shape for each position', () => {
        const stacks = [
            stack(3, -2, 'Block_Grass'),
            stack(4, -2, 'Block_Ground'),
        ];
        const [first] = resolveTerrainVergePlacements(blocks, stacks);
        const [second] = resolveTerrainVergePlacements(blocks, stacks);

        assert.equal(first.variant, second.variant);
        assert.ok(
            first.variant >= 0 && first.variant < terrainVergeVariantCount,
        );
    });
});
