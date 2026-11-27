import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import type { GardenStack } from '../../types/Stack';
import type { TerrainRimStripShape } from './terrainRimGeometry';
import {
    resolveTerrainRimPlacements,
    type TerrainRimPlacement,
    terrainRimBlockShapes,
    terrainRimBodyForSurface,
    terrainRimToeLipScale,
} from './terrainRimPlacements';
import { terrainStairNosingWidth } from './terrainShapes';

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
    ...Object.keys(terrainRimBlockShapes).map((name) => blockData(name, 0.4)),
    blockData('Block_Water', 0.4),
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

/** A stack of one block turned by `rotation` quarter turns. */
function turned(
    x: number,
    z: number,
    rotation: number,
    ...names: string[]
): GardenStack {
    return {
        position: { x, y: 0, z },
        blocks: names.map((name, index) => ({
            id: `${x}:${z}:${index}`,
            name,
            rotation: index === names.length - 1 ? rotation : 0,
        })),
    };
}

function strip(placement: TerrainRimPlacement): TerrainRimStripShape {
    assert.equal(placement.shape?.kind, 'strip');
    if (placement.shape?.kind !== 'strip') throw new Error('not a strip');
    return placement.shape;
}

/** The world height of a strip's top edge at its start and end. */
function stripEnds(placement: TerrainRimPlacement) {
    const { nodes } = strip(placement);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    return [
        Math.round((placement.top + first.y) * 100) / 100,
        Math.round((placement.top + last.y) * 100) / 100,
    ];
}

function describePlacements(stacks: GardenStack[]) {
    return resolveTerrainRimPlacements(blocks, stacks)
        .map(
            ({ kind, stack: { position }, turn }) =>
                `${position.x},${position.z}:${kind}${turn}`,
        )
        .sort();
}

describe('terrain rim placements', () => {
    it('wraps a lone block with four edges and four corners', () => {
        assert.deepEqual(describePlacements([stack(0, 0, 'Block_Grass')]), [
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

    it('leaves the seam between two level blocks untouched', () => {
        const placements = describePlacements([
            stack(0, 0, 'Block_Grass'),
            stack(1, 0, 'Block_Ground'),
        ]);

        // Turn 0 faces +x and turn 2 faces -x: the sides that touch.
        assert.equal(placements.includes('0,0:edge0'), false);
        assert.equal(placements.includes('1,0:edge2'), false);
        assert.equal(placements.includes('0,0:edge2'), true);
        assert.equal(placements.includes('1,0:edge0'), true);
        // Each block keeps only the two corners on its outer side.
        assert.deepEqual(
            placements.filter((placement) => placement.includes('corner')),
            ['0,0:corner2', '0,0:corner3', '1,0:corner0', '1,0:corner1'],
        );
    });

    it('treats lower terrain and water as an exposed side', () => {
        const placements = describePlacements([
            stack(0, 0, 'Block_Ground', 'Block_Grass'),
            stack(1, 0, 'Block_Ground'),
            stack(0, 1, 'Block_Water'),
        ]);

        // The upper grass block overlooks the lower neighbour on +x.
        assert.equal(placements.filter((p) => p === '0,0:edge0').length, 1);
        // Water never hides a side: both stacked blocks face it on +z.
        assert.equal(placements.filter((p) => p === '0,0:edge3').length, 2);
    });

    it('gives a lip only to the top terrain block of a column', () => {
        const placements = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Ground', 'Block_Grass', 'Raised_Bed'),
        ]);

        assert.equal(
            placements.every(
                (placement) =>
                    placement.hasLip ===
                    (placement.block.name === 'Block_Grass'),
            ),
            true,
        );
        assert.equal(placements[0].top, 0.4);
    });

    it('does not cap a run that carries on or meets a wall', () => {
        // Two level blocks: the runs carry on across the seam.
        assert.equal(
            describePlacements([
                stack(0, 0, 'Block_Grass'),
                stack(1, 0, 'Block_Stone'),
            ]).some((placement) => placement.includes('cap')),
            false,
        );
        // An inner corner: the -z run of (0,0) meets the wall of (1,-1).
        const inner = describePlacements([
            stack(0, 0, 'Block_Grass'),
            stack(1, 0, 'Block_Grass'),
            stack(1, -1, 'Block_Grass'),
        ]);
        assert.equal(
            inner.some((placement) => placement.includes('cap')),
            false,
        );
    });

    it('caps only the lip where the run steps up beside a taller column', () => {
        const placements = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Grass'),
            stack(1, 0, 'Block_Ground', 'Block_Grass'),
        ]);
        const caps = placements.filter((placement) =>
            placement.kind.startsWith('cap'),
        );

        // The lower block of the taller column carries the body on, but it
        // has no lip, so the grass lip of (0,0) is capped on both sides.
        assert.deepEqual(
            caps.map(
                ({ hasLip, kind, stack: { position }, turn }) =>
                    `${position.x},${position.z}:${kind}${turn}:${hasLip}`,
            ),
            ['0,0:cap-end1:true', '0,0:cap-start0:true'],
        );
    });

    it('rims every ground type, ramps, corners and stairs included', () => {
        for (const name of [
            'Block_Dry_Ground_Reverse_Corner',
            'Block_Grass_Angle',
            'Block_Grass_Corner',
            'Block_Grass_Reverse_Corner',
            'Block_Gravel_Angle',
            'Block_Ground_Angle',
            'Block_Polished_Stone_Angle',
            'Block_Polished_Stone_Stairs',
            'Block_Polished_Stone_Stairs_Corner',
            'Block_Sand_Angle',
            'Block_Snow_Corner',
            'Block_Stone_Angle',
            'Block_Stone_Stairs',
            'Block_Stone_Stairs_Corner',
            'Block_Stone_Stairs_Half',
            'Block_Swamp_Ground_Angle',
        ]) {
            assert.ok(name in terrainRimBlockShapes, name);
            assert.ok(
                resolveTerrainRimPlacements(blocks, [stack(0, 0, name)])
                    .length > 0,
                name,
            );
        }
    });

    it('follows a lone ramp down its sides in every rotation', () => {
        for (const rotation of [0, 1, 2, 3]) {
            const placements = resolveTerrainRimPlacements(blocks, [
                turned(0, 0, rotation, 'Block_Grass_Angle'),
            ]);
            const strips = new Map(
                placements
                    .filter((placement) => placement.kind === 'strip')
                    .map((placement) => [placement.turn, placement]),
            );
            assert.equal(strips.size, 4, `rotation ${rotation}`);
            // The ramp's own side `local` faces world side `local + rotation`.
            const side = (local: number) => {
                const placement = strips.get((local + rotation) % 4);
                assert.ok(placement, `rotation ${rotation} side ${local}`);
                return placement;
            };
            // The back wall tops out level and leans its lip into the slope.
            assert.deepEqual(stripEnds(side(0)), [0.4, 0.4]);
            assert.equal(strip(side(0)).tilt, 0.4);
            // The sides run from the toe up to the back and back down.
            assert.deepEqual(stripEnds(side(1)), [0, 0.4]);
            assert.equal(strip(side(1)).tilt, 0);
            assert.deepEqual(stripEnds(side(3)), [0.4, 0]);
            // The toe on the ground keeps a small nose.
            assert.deepEqual(stripEnds(side(2)), [0, 0]);
            assert.equal(strip(side(2)).tilt, -0.4);
            assert.ok(
                strip(side(2)).nodes.every(
                    (node) => node.k === terrainRimToeLipScale,
                ),
            );
            assert.deepEqual(
                placements
                    .filter((placement) => placement.kind === 'shaped-corner')
                    .map(
                        (placement) =>
                            `${(placement.turn - rotation + 4) % 4}:${
                                placement.shape?.kind === 'corner'
                                    ? placement.shape.y
                                    : ''
                            }`,
                    )
                    .sort(),
                ['0:0', '1:0', '2:-0.4', '3:-0.4'],
            );
            // Corners carry every run on, so nothing is capped.
            assert.equal(
                placements.some(
                    (placement) =>
                        placement.kind.startsWith('cap') ||
                        (placement.shape?.kind === 'strip' &&
                            (placement.shape.capStart ||
                                placement.shape.capEnd)),
                ),
                false,
            );
        }
    });

    it('follows outer and inner corners in every rotation', () => {
        const expected = {
            Block_Grass_Corner: {
                corners: ['0:-0.4', '1:0', '2:-0.4', '3:-0.4'],
                ends: [
                    [0.4, 0],
                    [0, 0.4],
                    [0, 0],
                    [0, 0],
                ],
            },
            Block_Grass_Reverse_Corner: {
                corners: ['0:0', '1:0', '2:0', '3:-0.4'],
                ends: [
                    [0.4, 0.4],
                    [0.4, 0.4],
                    [0, 0.4],
                    [0.4, 0],
                ],
            },
        };
        for (const [name, { corners, ends }] of Object.entries(expected)) {
            for (const rotation of [0, 1, 2, 3]) {
                const placements = resolveTerrainRimPlacements(blocks, [
                    turned(0, 0, rotation, name),
                ]);
                ends.forEach((sideEnds, local) => {
                    const placement = placements.find(
                        (candidate) =>
                            candidate.kind === 'strip' &&
                            candidate.turn === (local + rotation) % 4,
                    );
                    assert.ok(placement, `${name} r${rotation} s${local}`);
                    assert.deepEqual(
                        stripEnds(placement),
                        sideEnds,
                        `${name} r${rotation} s${local}`,
                    );
                });
                assert.deepEqual(
                    placements
                        .filter(
                            (placement) => placement.kind === 'shaped-corner',
                        )
                        .map(
                            (placement) =>
                                `${(placement.turn - rotation + 4) % 4}:${
                                    placement.shape?.kind === 'corner'
                                        ? placement.shape.y
                                        : ''
                                }`,
                        )
                        .sort(),
                    corners,
                    `${name} r${rotation}`,
                );
            }
        }
    });

    it('rims a flat block above a ramp toe and runs its lip down a ramp', () => {
        // The ramp's toe faces the grass: the grass shows its side above it.
        const aboveToe = describePlacements([
            stack(0, 0, 'Block_Grass'),
            turned(1, 0, 0, 'Block_Grass_Angle'),
        ]);
        assert.ok(aboveToe.includes('0,0:edge0'));
        assert.ok(aboveToe.includes('0,0:corner0'));
        assert.ok(aboveToe.includes('0,0:corner1'));

        // The ramp's back wall meets the grass: the grass's front and back
        // runs carry on down the ramp's sides with no cap.
        const placements = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Grass'),
            turned(1, 0, 2, 'Block_Grass_Angle'),
        ]);
        const described = describePlacements([
            stack(0, 0, 'Block_Grass'),
            turned(1, 0, 2, 'Block_Grass_Angle'),
        ]);
        assert.equal(described.includes('0,0:edge0'), false);
        assert.ok(described.includes('0,0:edge1'));
        assert.ok(described.includes('0,0:edge3'));
        const ramp = placements.filter(
            (placement) => placement.stack.position.x === 1,
        );
        const front = ramp.find(
            (placement) => placement.kind === 'strip' && placement.turn === 1,
        );
        const back = ramp.find(
            (placement) => placement.kind === 'strip' && placement.turn === 3,
        );
        assert.ok(front && back);
        // Side 1 starts at the grass's corner, side 3 ends there.
        assert.deepEqual(stripEnds(front), [0.4, 0]);
        assert.deepEqual(stripEnds(back), [0, 0.4]);
        assert.equal(
            placements.some(
                (placement) =>
                    placement.kind.startsWith('cap') ||
                    (placement.shape?.kind === 'strip' &&
                        (placement.shape.capStart || placement.shape.capEnd)),
            ),
            false,
        );
    });

    it("tapers a lip away where a ramp's side climbs to it", () => {
        // The ramp's -z side faces the grass, rising from -x to +x.
        const placements = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Grass'),
            turned(0, 1, 0, 'Block_Grass_Angle'),
        ]);
        const side = placements.find(
            (placement) =>
                placement.stack.position.z === 0 &&
                placement.kind === 'strip' &&
                placement.turn === 3,
        );
        assert.ok(side);
        // Side 3 runs from +x, where the ramp reaches the grass top, to -x.
        assert.deepEqual(
            strip(side).nodes.map(({ t, y, k }) => `${t}@${y}:${k}`),
            ['0@0:0', '0.5@0:1', '1@0:1'],
        );
        // The ramp's own side there is covered.
        assert.equal(
            placements.some(
                (placement) =>
                    placement.stack.position.z === 1 && placement.turn === 1,
            ),
            false,
        );
    });

    it('sinks a hard lip into a slope beside it instead of tapering it', () => {
        // Stone stairs beside a stone ramp that climbs along their -z side:
        // both steps show above the slope near its toe and sink into it
        // where it rises to them.
        for (let rotation = 0; rotation < 4; rotation++) {
            const turn = (offset: number) => (offset + rotation) % 4;
            // The ramp sits on the stairs' side `turn(1)`, turned so its
            // slope rises the way the stairs do.
            const offsets = [
                [1, 0],
                [0, -1],
                [-1, 0],
                [0, 1],
            ];
            const [dx, dz] = offsets[turn(1)];
            const placements = resolveTerrainRimPlacements(blocks, [
                turned(0, 0, rotation, 'Block_Stone_Stairs'),
                turned(dx, dz, rotation, 'Block_Stone_Angle'),
            ]);
            const side = placements
                .filter(
                    (placement) =>
                        placement.stack.position.x === 0 &&
                        placement.stack.position.z === 0 &&
                        placement.kind === 'strip' &&
                        placement.turn === turn(1),
                )
                .map((placement) => {
                    const shape = strip(placement);
                    const ends = [
                        shape.capStart ? ':cap-start' : '',
                        shape.capEnd ? ':cap-end' : '',
                        shape.cutStart ? ':cut-start' : '',
                        shape.cutEnd ? ':cut-end' : '',
                    ].join('');
                    return `${shape.nodes.map(({ t, k }) => `${t}:${k}`).join(',')}${ends}`;
                })
                .sort();
            // Full size all along. Where the slope buries an end no cap is
            // needed; the upper step still ends flush above the slope at
            // the riser.
            assert.deepEqual(
                side,
                ['0.5:1,1:1:cut-start', '0:1,0.5:1'],
                `rotation ${rotation}`,
            );
        }
        // A flat stone block beside a stone ramp's side keeps a flat edge,
        // sunk into the slope, and no cap where the slope reaches its top.
        const flat = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Stone'),
            turned(0, 1, 0, 'Block_Stone_Angle'),
        ]).filter((placement) => placement.stack.position.z === 0);
        assert.ok(
            flat.some(
                (placement) =>
                    placement.kind === 'edge' && placement.turn === 3,
            ),
        );
        assert.equal(
            flat.some((placement) => placement.kind.startsWith('cap')),
            false,
        );
        // Soil still rolls its lip away into the slope.
        const grass = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Grass'),
            turned(0, 1, 0, 'Block_Grass_Angle'),
        ]).find(
            (placement) =>
                placement.stack.position.z === 0 &&
                placement.kind === 'strip' &&
                placement.turn === 3,
        );
        assert.ok(grass);
        assert.deepEqual(
            strip(grass).nodes.map(({ k }) => k),
            [0, 1, 1],
        );
    });

    it('keeps the lip of a floor at the toe of the ramp it carries', () => {
        const placements = resolveTerrainRimPlacements(blocks, [
            turned(0, 0, 0, 'Block_Grass', 'Block_Grass_Angle'),
        ]);
        // Under the toe the floor's lip carries the slope over the edge;
        // under the ramp's sides and back its soil runs up to its top.
        assert.deepEqual(
            placements
                .filter((placement) => placement.blockIndex === 0)
                .map(({ hasLip, kind, turn }) => `${kind}${turn}:${hasLip}`)
                .sort(),
            [
                'corner0:false',
                'corner1:false',
                'corner2:true',
                'corner3:true',
                'edge0:false',
                'edge1:false',
                'edge2:true',
                'edge3:false',
            ],
        );
        const ramp = placements.filter(
            (placement) => placement.blockIndex === 1,
        );
        // The toe has no wall of its own on the floor.
        assert.equal(
            ramp.some(
                (placement) =>
                    placement.kind === 'strip' && placement.turn === 2,
            ),
            false,
        );
        assert.deepEqual(
            ramp
                .filter((placement) => placement.kind === 'shaped-corner')
                .map((placement) => placement.turn)
                .sort(),
            [0, 1],
        );
        // Up off the ground the side lips keep their full size and run
        // into the floor's toe corners without a cap.
        for (const placement of ramp) {
            if (placement.kind !== 'strip') continue;
            const shape = strip(placement);
            assert.ok(shape.nodes.every((node) => node.k === 1));
            assert.equal(shape.capStart || shape.capEnd, false);
        }
    });

    it('splits stair sides at the step and closes both halves there', () => {
        const placements = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Stone_Stairs'),
        ]);
        // The upper step's lip ends flush with the riser (`cut`); the lower
        // step's curls into the riser's foot (`cap`), toward the upper half.
        assert.deepEqual(
            placements
                .filter((placement) => placement.kind === 'strip')
                .map((placement) => {
                    const shape = strip(placement);
                    const nodes = shape.nodes
                        .map((node) => `${node.t}@${node.y}`)
                        .join(',');
                    const ends = [
                        shape.capStart ? ':cap-start' : '',
                        shape.capEnd ? ':cap-end' : '',
                        shape.cutStart ? ':cut-start' : '',
                        shape.cutEnd ? ':cut-end' : '',
                    ].join('');
                    return `${placement.turn}:${nodes}${ends}`;
                })
                .sort(),
            [
                '1:0.5@0,1@0:cut-start',
                '1:0@-0.2,0.5@-0.2:cap-end',
                '2:0@-0.2,1@-0.2',
                '3:0.5@-0.2,1@-0.2:cap-start',
                '3:0@0,0.5@0:cut-end',
            ],
        );
        // Beside a neighbour as high as the upper step, the lower step's
        // lip runs into it and the upper step has no side to close.
        const walled = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Stone_Stairs'),
            stack(0, -1, 'Block_Stone'),
        ]).filter(
            (placement) =>
                placement.stack.position.z === 0 && placement.turn === 1,
        );
        assert.deepEqual(walled, []);
        // The upper step's back keeps the flat pieces.
        assert.deepEqual(
            describePlacements([stack(0, 0, 'Block_Stone_Stairs')]).filter(
                (placement) =>
                    placement.includes('edge') || placement.includes(':corner'),
            ),
            ['0,0:corner0', '0,0:corner1', '0,0:edge0'],
        );
    });

    it('covers the rounded nosing of a lower step in every rotation', () => {
        for (let rotation = 0; rotation < 4; rotation++) {
            // Local side and where its inset is mitred: only at the corner
            // the two fronts of the corner stairs share.
            for (const [name, sides] of [
                ['Block_Polished_Stone_Stairs', ['2:']],
                ['Block_Stone_Stairs', ['2:']],
                ['Block_Stone_Stairs_Corner', ['2:start', '3:end']],
            ] as const) {
                const placements = resolveTerrainRimPlacements(blocks, [
                    turned(0, 0, rotation, name),
                ]);
                const insets = placements
                    .filter((placement) => placement.shape?.kind === 'strip')
                    .flatMap((placement) => {
                        const { inset } = strip(placement);
                        if (!inset) return [];
                        assert.equal(inset.width, terrainStairNosingWidth);
                        const mitre = `${inset.mitreStart ? 'start' : ''}${inset.mitreEnd ? 'end' : ''}`;
                        return [`${placement.turn}:${mitre}`];
                    })
                    .sort();
                assert.deepEqual(
                    insets,
                    sides
                        .map((entry) => {
                            const [side, mitre] = entry.split(':');
                            return `${(Number(side) + rotation) % 4}:${mitre}`;
                        })
                        .sort(),
                    `${name} r${rotation}`,
                );
            }
        }
        // A row of stairs runs its insets on from tile to tile.
        const row = resolveTerrainRimPlacements(blocks, [
            stack(0, 0, 'Block_Stone_Stairs'),
            stack(0, 1, 'Block_Stone_Stairs'),
        ]).filter(
            (placement) =>
                placement.shape?.kind === 'strip' && strip(placement).inset,
        );
        assert.equal(row.length, 2);
        for (const placement of row) {
            assert.deepEqual(strip(placement).inset, {
                width: terrainStairNosingWidth,
                mitreStart: false,
                mitreEnd: false,
            });
        }
        // Ramps and corners have no nosing of their own.
        for (const name of ['Block_Grass_Angle', 'Block_Sand_Corner']) {
            assert.ok(
                resolveTerrainRimPlacements(blocks, [stack(0, 0, name)]).every(
                    (placement) =>
                        placement.shape?.kind !== 'strip' ||
                        placement.shape.inset === undefined,
                ),
            );
        }
    });

    it('runs one lip down a double slope without caps', () => {
        const placements = resolveTerrainRimPlacements(blocks, [
            turned(0, 0, 0, 'Block_Grass_Angle'),
            turned(1, 0, 0, 'Block_Grass', 'Block_Grass_Angle'),
        ]);
        // The lower ramp's back wall meets the upper column's floor.
        assert.equal(
            placements.some(
                (placement) =>
                    placement.stack.position.x === 0 &&
                    placement.kind === 'strip' &&
                    placement.turn === 0,
            ),
            false,
        );
        const upper = placements.find(
            (placement) =>
                placement.stack.position.x === 1 &&
                placement.blockIndex === 1 &&
                placement.kind === 'strip' &&
                placement.turn === 1,
        );
        assert.ok(upper);
        assert.deepEqual(stripEnds(upper), [0.4, 0.8]);
        assert.equal(
            placements.some(
                (placement) =>
                    placement.kind.startsWith('cap') ||
                    (placement.shape?.kind === 'strip' &&
                        (placement.shape.capStart || placement.shape.capEnd)),
            ),
            false,
        );
    });

    it('shows soil under ground and stone under stone', () => {
        assert.equal(terrainRimBodyForSurface('grass'), 'soil');
        assert.equal(terrainRimBodyForSurface('gravel'), 'soil');
        assert.equal(terrainRimBodyForSurface('swampDirt'), 'soil');
        assert.equal(terrainRimBodyForSurface('stone'), 'stone');
        assert.equal(
            terrainRimBodyForSurface('polishedStone'),
            'polishedStone',
        );
    });

    it('returns nothing without block data or stacks', () => {
        assert.deepEqual(resolveTerrainRimPlacements(null, []), []);
        assert.deepEqual(resolveTerrainRimPlacements(blocks, undefined), []);
    });
});
