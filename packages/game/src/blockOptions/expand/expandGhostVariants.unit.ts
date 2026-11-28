import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BoxGeometry, Matrix4, MeshBasicMaterial } from 'three';
import { resolveFenceConnectionState } from '../../entities/helpers/useFenceConnectionState';
import {
    resolveWaterFoamEdges,
    resolveWaterRimExposure,
} from '../../entities/waterBlockFoam';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { GardenStack } from '../../types/Stack';
import { getStackHeight } from '../../utils/stackHeightCore';
import {
    type ExpandGhostVariant,
    getExpandGhostNeighbourKind,
    loneExpandGhostVariantKey,
    mergeExpandGhostParts,
    resolveExpandGhostVariants,
} from './expandGhostVariants';
import { createExpandGhostWorld } from './expandGhostWorld';
import type { ExpandCell } from './expandPointer';
import type { GhostTemplateCollection } from './ghostTemplateParts';

const blockData = getLocalSandboxBlockData();

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

/** Every cell of the rectangle from (0, 0) to `corner` but the source. */
function rectangle(corner: ExpandCell): ExpandCell[] {
    const cells: ExpandCell[] = [];
    for (let x = Math.min(0, corner.x); x <= Math.max(0, corner.x); x++) {
        for (let z = Math.min(0, corner.z); z <= Math.max(0, corner.z); z++) {
            if (x !== 0 || z !== 0) cells.push({ x, z });
        }
    }
    return cells;
}

function resolve(
    blockName: string,
    cells: ExpandCell[],
    stacks: GardenStack[],
    rotation = 0,
) {
    return resolveExpandGhostVariants({
        blockData,
        blockName,
        cells,
        rotation,
        stacks,
    });
}

function cellsOf(variants: ExpandGhostVariant[]) {
    return variants
        .flatMap((variant) => variant.cells)
        .map(({ x, z }) => `${x},${z}`)
        .sort();
}

/** The fence shape a variant's template resolves from its own stacks. */
function templateFenceShape({ template }: ExpandGhostVariant) {
    const state = resolveFenceConnectionState(
        template.stacks,
        template.stack,
        template.block,
        template.block.rotation,
    );
    return `${state.connection.shape}:${state.connection.rotation}`;
}

describe('getExpandGhostNeighbourKind', () => {
    it('names the blocks whose look follows their neighbours', () => {
        assert.equal(getExpandGhostNeighbourKind('Fence'), 'fence');
        assert.equal(getExpandGhostNeighbourKind('StoneFence'), 'fence');
        assert.equal(getExpandGhostNeighbourKind('Shade'), 'shade');
        assert.equal(getExpandGhostNeighbourKind('Block_Water'), 'water');
        assert.equal(getExpandGhostNeighbourKind('Block_Swamp_Water'), 'water');
        assert.equal(getExpandGhostNeighbourKind('Bush'), null);
        assert.equal(getExpandGhostNeighbourKind('Block_Grass'), null);
        assert.equal(getExpandGhostNeighbourKind('FenceGate'), null);
    });
});

describe('resolveExpandGhostVariants', () => {
    it('draws a block that ignores its neighbours from one lone template', () => {
        const cells = rectangle({ x: 2, z: 1 });
        const variants = resolve('Bush', cells, [
            stack(0, 0, 'Block_Grass', 'Bush'),
            stack(1, 0, 'Block_Grass'),
        ]);

        assert.equal(variants.length, 1);
        const [lone] = variants;
        assert.equal(lone?.key, loneExpandGhostVariantKey);
        assert.deepEqual(lone?.cells, cells);
        // The template reads no garden: only its own stack, at the origin.
        assert.equal(lone?.template.baseHeight, 0);
        assert.deepEqual(lone?.template.stacks, [lone?.template.stack]);
        assert.deepEqual(lone?.template.stack.blocks, [lone?.template.block]);
        assert.deepEqual(lone?.template.stack.position.toArray(), [0, 0, 0]);
    });

    it('keeps the lone template while the corner is on the source', () => {
        const variants = resolve('Fence', [], [stack(0, 0, 'Fence')]);

        assert.equal(variants.length, 1);
        assert.equal(variants[0]?.key, loneExpandGhostVariantKey);
        assert.deepEqual(variants[0]?.cells, []);
    });

    it('joins a stretched fence row: ends and middles, as placed', () => {
        // Source at (0, 0); the row runs to (0, 3).
        const variants = resolve('Fence', rectangle({ x: 0, z: 3 }), [
            stack(0, 0, 'Fence'),
        ]);

        assert.deepEqual(cellsOf(variants), ['0,1', '0,2', '0,3']);
        const shapeByCell = new Map(
            variants.flatMap((variant) =>
                variant.cells.map((cell) => [
                    `${cell.x},${cell.z}`,
                    templateFenceShape(variant),
                ]),
            ),
        );
        assert.equal(shapeByCell.get('0,1')?.split(':')[0], 'Middle');
        assert.equal(shapeByCell.get('0,2')?.split(':')[0], 'Middle');
        assert.equal(shapeByCell.get('0,3')?.split(':')[0], 'Single');
        // Two shapes, two templates: the middles share one.
        assert.equal(variants.length, 2);
    });

    it('gives each copy of a 3 × 3 fence the shape the placed fence has', () => {
        const garden = [stack(0, 0, 'StoneFence')];
        const cells = rectangle({ x: 2, z: 2 });
        const variants = resolve('StoneFence', cells, garden);
        const world = createExpandGhostWorld({
            blockName: 'StoneFence',
            cells,
            reach: 1,
            rotation: 0,
            stacks: garden,
        });

        assert.deepEqual(
            cellsOf(variants),
            cells.map(({ x, z }) => `${x},${z}`).sort(),
        );
        for (const variant of variants) {
            for (const cell of variant.cells) {
                const copy = world.copies.find(
                    (candidate) =>
                        candidate.cell.x === cell.x &&
                        candidate.cell.z === cell.z,
                );
                assert.ok(copy);
                const placed = resolveFenceConnectionState(
                    world.stacks,
                    copy.stack,
                    copy.block,
                    0,
                );
                assert.equal(
                    templateFenceShape(variant),
                    `${placed.connection.shape}:${placed.connection.rotation}`,
                    `cell ${cell.x},${cell.z}`,
                );
            }
        }
        const centre = variants.find((variant) =>
            variant.cells.some((cell) => cell.x === 1 && cell.z === 1),
        );
        assert.ok(centre);
        assert.equal(templateFenceShape(centre).split(':')[0], 'Cross');
        // Corners, sides and the middle: never more than nine shapes.
        assert.ok(variants.length <= 9);
    });

    it('joins a fence copy to a garden fence beside the rectangle', () => {
        const variants = resolve(
            'Fence',
            [{ x: 0, z: 1 }],
            [stack(0, 0, 'Fence'), stack(0, 2, 'Fence')],
        );

        assert.equal(variants.length, 1);
        const [variant] = variants;
        assert.ok(variant);
        assert.equal(templateFenceShape(variant).split(':')[0], 'Middle');
    });

    it('never reads the garden near the origin for a fence template', () => {
        // The source and its copy are far from (0, 0), where a garden fence
        // stands; the templates read only their own stacks.
        const variants = resolve(
            'Fence',
            [{ x: 10, z: 11 }],
            [
                stack(10, 10, 'Fence'),
                stack(1, 0, 'Fence'),
                stack(0, 1, 'Fence'),
            ],
        );

        const alone = resolve(
            'Fence',
            [{ x: 10, z: 11 }],
            [stack(10, 10, 'Fence')],
        );

        assert.equal(variants.length, 1);
        const [variant] = variants;
        assert.ok(variant);
        const [aloneVariant] = alone;
        assert.ok(aloneVariant);
        assert.equal(templateFenceShape(variant).split(':')[0], 'Single');
        assert.equal(
            templateFenceShape(variant),
            templateFenceShape(aloneVariant),
        );
        assert.ok(
            variant.template.stacks.every(
                (candidate) =>
                    Math.abs(candidate.position.x) <= 1 &&
                    Math.abs(candidate.position.z) <= 1,
            ),
        );
        assert.deepEqual(variant.template.stack.position.toArray(), [0, 0, 0]);
    });

    it('lowers a template by the block it stands on', () => {
        const garden = [
            stack(0, 0, 'Block_Grass', 'Fence'),
            stack(1, 0, 'Block_Grass'),
        ];
        const variants = resolve('Fence', [{ x: 1, z: 0 }], garden);

        const [variant] = variants;
        assert.ok(variant);
        assert.deepEqual(
            variant.template.stack.blocks.map((block) => block.name),
            ['Block_Grass', 'Fence'],
        );
        assert.equal(
            variant.template.baseHeight,
            getStackHeight(blockData, garden[1]),
        );
        assert.ok(variant.template.baseHeight > 0);
    });

    it('merges 3 × 3 water into one slab: no rim between copies', () => {
        const garden = [stack(0, 0, 'Block_Water')];
        const cells = rectangle({ x: 2, z: 2 });
        const variants = resolve('Block_Water', cells, garden);

        assert.deepEqual(
            cellsOf(variants),
            cells.map(({ x, z }) => `${x},${z}`).sort(),
        );
        // Corners, sides and the middle.
        assert.ok(variants.length <= 9);
        for (const variant of variants) {
            const { block, stack: own, stacks } = variant.template;
            const input = { block, blockData, stack: own, stacks };
            const edges = resolveWaterRimExposure(input).edges.toArray();
            const foam = resolveWaterFoamEdges(input).toArray();
            for (const cell of variant.cells) {
                // Edge order: -x, +x, -z, +z. A side is open only on the
                // rectangle's outer edge.
                const outer = [
                    cell.x === 0,
                    cell.x === 2,
                    cell.z === 0,
                    cell.z === 2,
                ];
                assert.deepEqual(
                    edges.map((edge) => edge === 1),
                    outer,
                    `rim of ${cell.x},${cell.z}`,
                );
                assert.deepEqual(
                    foam.map((edge) => edge === 1),
                    outer,
                    `foam of ${cell.x},${cell.z}`,
                );
            }
        }
        const middle = variants.find((variant) =>
            variant.cells.some((cell) => cell.x === 1 && cell.z === 1),
        );
        assert.equal(middle?.cells.length, 1);
    });

    it('opens a water copy towards a lower neighbour only', () => {
        // A grass bank as high as the water on the far side keeps it closed.
        const garden = [stack(0, 0, 'Block_Water'), stack(2, 0, 'Block_Grass')];
        const variants = resolve('Block_Water', [{ x: 1, z: 0 }], garden);

        const [variant] = variants;
        assert.ok(variant);
        const { block, stack: own, stacks } = variant.template;
        const edges = resolveWaterRimExposure({
            block,
            blockData,
            stack: own,
            stacks,
        }).edges.toArray();
        assert.deepEqual(edges, [0, 0, 1, 1]);
    });
});

describe('mergeExpandGhostParts', () => {
    const post = new BoxGeometry();
    const rail = new BoxGeometry();
    const planks = new MeshBasicMaterial();
    const turned = new Matrix4().makeRotationY(Math.PI / 2);

    it('draws a part shared by several shapes as one part', () => {
        const middle = {
            key: 'fence:Middle',
            cells: [
                { x: 0, z: 1 },
                { x: 0, z: 2 },
            ],
        };
        const end = { key: 'fence:Single', cells: [{ x: 0, z: 3 }] };
        const collections = new Map<string, GhostTemplateCollection>([
            [
                middle.key,
                {
                    kind: 'parts',
                    parts: [
                        {
                            geometry: post,
                            material: planks,
                            localMatrices: [new Matrix4()],
                        },
                        {
                            geometry: rail,
                            material: planks,
                            localMatrices: [new Matrix4(), turned],
                        },
                    ],
                },
            ],
            [
                end.key,
                {
                    kind: 'parts',
                    parts: [
                        {
                            geometry: post,
                            material: planks,
                            localMatrices: [turned],
                        },
                    ],
                },
            ],
        ]);

        const merged = mergeExpandGhostParts([middle, end], collections);

        assert.equal(merged.length, 2);
        const [posts, rails] = merged;
        assert.equal(posts?.geometry, post);
        assert.deepEqual(
            posts?.groups.map((group) => group.cells),
            [middle.cells, end.cells],
        );
        assert.equal(posts?.instanceCount, 3);
        assert.equal(rails?.geometry, rail);
        assert.equal(rails?.instanceCount, 4);
    });

    it('leaves out shapes that are loading or fell back', () => {
        const parts: GhostTemplateCollection = {
            kind: 'parts',
            parts: [
                {
                    geometry: post,
                    material: planks,
                    localMatrices: [new Matrix4()],
                },
            ],
        };
        const merged = mergeExpandGhostParts(
            [
                { key: 'a', cells: [{ x: 1, z: 0 }] },
                { key: 'b', cells: [{ x: 2, z: 0 }] },
                { key: 'c', cells: [{ x: 3, z: 0 }] },
            ],
            new Map<string, GhostTemplateCollection>([
                ['a', parts],
                ['c', { kind: 'fallback', reason: 'no-mesh' }],
            ]),
        );

        assert.equal(merged.length, 1);
        assert.equal(merged[0]?.instanceCount, 1);
        assert.deepEqual(merged[0]?.groups[0]?.cells, [{ x: 1, z: 0 }]);
    });
});
