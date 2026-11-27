import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { Stack } from '../../types/Stack';
import { resolveWaterRimExposure } from '../waterBlockFoam';
import { levelWaterfallFloors } from './waterfallFloorProfile';
import {
    resolveWaterfallColumns,
    type WaterfallColumn,
    waterfallFloors,
    waterfallGroundRunoutOffset,
    waterfallIslandBaseY,
    waterfallSupportedRunoutOffset,
    waterfallVoidFloorY,
} from './waterfallPlacements';

const blockData = getLocalSandboxBlockData();
let nextId = 0;

const G = 'Block_Grass';
const W = 'Block_Water';
const RAMP = 'Block_Grass_Angle';
const STAIRS = 'Block_Stone_Stairs';

/**
 * A stack of blocks; a name may carry a rotation as `name@turns`, for the
 * ramps and stairs, which rise towards +x at rotation 0.
 */
function stack(x: number, z: number, names: string[]): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks: names.map((entry) => {
            const [name = entry, turns = '0'] = entry.split('@');
            return { id: `b${++nextId}`, name, rotation: Number(turns) };
        }),
    };
}

/** Rotation that turns a ramp's toe (its -x side at rotation 0) to `side`. */
const toeTowards = {
    '-x': 0,
    '+x': 2,
    '-z': 3,
    '+z': 1,
} as const;

/** A lawn of single grass blocks over [x0, x1] × [z0, z1]. */
function lawn(x0: number, x1: number, z0: number, z1: number) {
    const stacks = new Map<string, Stack>();
    for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
            stacks.set(`${x}|${z}`, stack(x, z, [G]));
        }
    }
    return {
        set(x: number, z: number, names: string[]) {
            stacks.set(`${x}|${z}`, stack(x, z, names));
            return this;
        },
        stacks() {
            return [...stacks.values()];
        },
    };
}

function columns(stacks: Stack[]) {
    return resolveWaterfallColumns({ blockData, stacks });
}

function columnAt(list: WaterfallColumn[], x: number, z: number) {
    const found = list.filter((column) => column.x === x && column.z === z);
    assert.equal(found.length, 1, `one column at ${x},${z}`);
    const [column] = found;
    assert.ok(column);
    return column;
}

function landings(column: WaterfallColumn) {
    return column.sides.map((side) => side.landing);
}

function close(actual: number, expected: number, message?: string) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${message ?? 'value'}: ${actual} != ${expected}`,
    );
}

function closeAll(
    actual: readonly number[] | undefined,
    expected: readonly number[],
    message: string,
) {
    assert.ok(actual, message);
    assert.equal(actual.length, expected.length, message);
    for (const [index, value] of expected.entries()) {
        close(actual[index] ?? Number.NaN, value, `${message} [${index}]`);
    }
}

describe('resolveWaterfallColumns', () => {
    it('lets a lone ground-level block fall off the island on every side', () => {
        const [column] = columns([stack(0, 0, [W])]);
        assert.ok(column);
        assert.deepEqual(landings(column), ['void', 'void', 'void', 'void']);
        assert.deepEqual(
            waterfallFloors(column),
            levelWaterfallFloors(waterfallVoidFloorY),
        );
        close(column.surfaceY, 0.34, 'surface');
        close(column.bottomY, waterfallIslandBaseY, 'bottom');
        assert.equal(column.supportTopY, null);
        close(column.runoutTopY, waterfallIslandBaseY, 'run-out top');
        assert.equal(column.runoutOffset, waterfallGroundRunoutOffset);
        assert.ok(column.sides.every((side) => !side.skirt));
    });

    it('lands the user screenshot case on the grass and drops the rest off the edge', () => {
        // Water two high, one grass block at -z.
        const list = columns([stack(0, 0, [W, W]), stack(0, -1, [G])]);
        assert.equal(list.length, 1, 'one column for a stacked pair');
        const column = columnAt(list, 0, 0);
        close(column.surfaceY, 0.74, 'surface');
        assert.deepEqual(landings(column), ['void', 'void', 'terrain', 'void']);
        close(column.sides[2].floorY, 0.4, 'grass floor');
        assert.equal(column.sides[2].skirt, true);
        // Nothing continues the skirt on either end.
        assert.equal(column.sides[2].skirtStart, 'free');
        assert.equal(column.sides[2].skirtEnd, 'free');
    });

    it('follows the layout when it is turned a quarter', () => {
        // The same pair with the grass at +x instead of -z.
        const column = columnAt(
            columns([stack(0, 0, [W, W]), stack(1, 0, [G])]),
            0,
            0,
        );
        assert.deepEqual(landings(column), ['void', 'terrain', 'void', 'void']);
        close(column.sides[1].floorY, 0.4, 'grass floor');
    });

    it('falls on all four sides of raised water in a lawn, with corner foam', () => {
        const stacks = lawn(-1, 1, -1, 1).set(0, 0, [G, W]).stacks();
        const column = columnAt(columns(stacks), 0, 0);
        close(column.surfaceY, 0.74, 'surface');
        assert.deepEqual(landings(column), [
            'terrain',
            'terrain',
            'terrain',
            'terrain',
        ]);
        for (const side of column.sides) {
            close(side.floorY, 0.4, 'floor');
            assert.equal(side.skirt, true);
            assert.equal(side.skirtStart, 'corner');
            assert.equal(side.skirtEnd, 'corner');
        }
        assert.deepEqual(column.skirtCorners, [true, true, true, true]);
        assert.equal(column.supportTopY, 0.4);
    });

    it('drops a three-high column onto the lawn from its top', () => {
        const stacks = lawn(-1, 1, -1, 1).set(0, 0, [W, W, W]).stacks();
        const list = columns(stacks);
        assert.equal(list.length, 1);
        const column = columnAt(list, 0, 0);
        close(column.surfaceY, 1.14, 'surface');
        assert.ok(column.sides.every((side) => side.landing === 'terrain'));
        assert.ok(
            column.sides.every((side) => Math.abs(side.floorY - 0.4) < 1e-6),
        );
        close(column.bottomY, waterfallIslandBaseY, 'bottom');
    });

    it('shows no fall beside a bank, water at the same level or a ramp crest as high', () => {
        const stacks = lawn(-2, 2, -2, 2)
            .set(0, 0, [G, W])
            .set(-1, 0, [G, G])
            .set(1, 0, [G, W])
            // The ramp's crest (its +x side at rotation 0) faces +z.
            .set(0, -1, [G, `${RAMP}@3`])
            .set(0, 1, [W])
            .stacks();
        const column = columnAt(columns(stacks), 0, 0);
        assert.equal(column.sides[0].landing, 'none', 'bank');
        assert.equal(column.sides[1].landing, 'none', 'same-level water');
        assert.equal(column.sides[2].landing, 'none', 'ramp crest');
        // A covered side's floor is the surface, so the wall shows no fall.
        close(column.sides[0].floorY, column.surfaceY, 'covered floor');
        // Lower water: the fall lands on its top.
        assert.equal(column.sides[3].landing, 'water');
        close(column.sides[3].floorY, 0.34, 'lower water top');
        assert.equal(column.sides[3].skirt, true);
    });

    it('steps a cascade down onto each lower water top', () => {
        const stacks = lawn(-2, 2, -1, 1)
            .set(2, 0, [W, W, W])
            .set(1, 0, [W, W])
            .set(0, 0, [W])
            .stacks();
        const list = columns(stacks);
        const top = columnAt(list, 2, 0);
        const middle = columnAt(list, 1, 0);
        const bottom = columnAt(list, 0, 0);
        assert.equal(top.sides[0].landing, 'water');
        close(top.sides[0].floorY, 0.74, 'onto the middle step');
        assert.equal(middle.sides[0].landing, 'water');
        close(middle.sides[0].floorY, 0.34, 'onto the bottom step');
        // The bottom step is a pond in the lawn, and the middle step's water
        // covers its +x side.
        assert.deepEqual(landings(bottom), ['none', 'none', 'none', 'none']);
        // The top step's +x side is the island edge.
        assert.equal(top.sides[1].landing, 'void');
        assert.equal(top.supportTopY, null);
    });

    it('pours raised water at the island edge over its support block', () => {
        const stacks = lawn(-1, 1, 0, 1).set(0, 0, [G, W]).stacks();
        const column = columnAt(columns(stacks), 0, 0);
        assert.equal(column.sides[2].landing, 'void');
        assert.equal(column.sides[3].landing, 'terrain');
        assert.equal(column.supportTopY, 0.4);
        close(column.runoutTopY, 0.4, 'run-out starts at the support top');
        assert.equal(column.runoutOffset, waterfallSupportedRunoutOffset);
        // The edge falls have no skirt; the lawn sides keep theirs, and the
        // corner patches stop where the edge begins.
        assert.equal(column.sides[2].skirt, false);
        assert.deepEqual(column.skirtCorners, [false, false, true, true]);
        assert.equal(column.sides[0].skirtStart, 'free');
        assert.equal(column.sides[0].skirtEnd, 'corner');
    });

    it('joins the landing foam along a raised pool and mitres it at an inner corner', () => {
        // An L of raised water in a lawn: (0,0), (1,0) and (0,1).
        const stacks = lawn(-1, 2, -1, 2)
            .set(0, 0, [G, W])
            .set(1, 0, [G, W])
            .set(0, 1, [G, W])
            .stacks();
        const list = columns(stacks);
        const corner = columnAt(list, 0, 0);
        const east = columnAt(list, 1, 0);
        const north = columnAt(list, 0, 1);
        // -z skirt of (0,0) runs on into (1,0)'s.
        assert.equal(corner.sides[2].skirtEnd, 'continued');
        assert.equal(east.sides[2].skirtStart, 'continued');
        // (1,0)'s +z skirt and (0,1)'s +x skirt both land on (1,1) and meet
        // on its diagonal.
        assert.equal(east.sides[3].skirtStart, 'mitre');
        assert.equal(north.sides[1].skirtStart, 'mitre');
        // Outer corners round off.
        assert.equal(corner.skirtCorners[0], true);
        assert.equal(east.skirtCorners[1], true);
    });

    it('keeps foam off ground that turns under it and off raised beds', () => {
        const stacks = [
            stack(0, 0, [G, G, W]),
            // A ramp side-on, rising towards +x.
            stack(0, 1, [RAMP]),
            stack(1, 0, [G, 'Raised_Bed']),
            stack(0, -1, [STAIRS]),
            stack(-1, 0, [G]),
        ];
        const column = columnAt(columns(stacks), 0, 0);
        assert.equal(column.sides[3].landing, 'terrain');
        assert.equal(column.sides[3].skirt, false, 'no foam on a slope');
        assert.equal(column.sides[1].landing, 'terrain');
        assert.equal(column.sides[1].skirt, false, 'no foam under a bed');
        assert.equal(column.sides[2].landing, 'terrain');
        assert.equal(column.sides[2].skirt, false, 'no foam on stairs');
        assert.equal(column.sides[0].skirt, true);
    });

    it('lands on a ramp beside the water along its slope', () => {
        // Raised water with a ramp side-on at -z, rising towards +x.
        const stacks = lawn(-1, 1, -1, 1)
            .set(0, 0, [G, W])
            .set(0, -1, [G, RAMP])
            .stacks();
        const side = columnAt(columns(stacks), 0, 0).sides[2];
        assert.equal(side.landing, 'terrain');
        assert.deepEqual(
            side.floorProfile.map((height) => Number(height.toFixed(6))),
            [0.4, 0.6, 0.6, 0.8],
        );
        close(side.floorY, 0.4, 'lowest point');
        assert.equal(side.skirt, false);
        // Turned half round, it rises the other way along the side.
        const turned = lawn(-1, 1, -1, 1)
            .set(0, 0, [G, W])
            .set(0, -1, [G, `${RAMP}@2`])
            .stacks();
        assert.deepEqual(
            columnAt(columns(turned), 0, 0).sides[2].floorProfile.map(
                (height) => Number(height.toFixed(6)),
            ),
            [0.8, 0.6, 0.6, 0.4],
        );
    });

    it('lands at the foot of stairs where their lower step is', () => {
        // Stairs at -z: upper step on the +x half.
        const stacks = lawn(-1, 1, -1, 1)
            .set(0, 0, [G, W])
            .set(0, -1, [STAIRS])
            .stacks();
        const side = columnAt(columns(stacks), 0, 0).sides[2];
        assert.deepEqual(
            side.floorProfile.map((height) => Number(height.toFixed(6))),
            [0.2, 0.2, 0.4, 0.4],
        );
        assert.equal(side.spill, true, 'the support shows over the step');
    });

    it('falls from a ground pond onto the toes of ramps sloping into it', () => {
        const stacks = [
            stack(0, 0, [W]),
            stack(-1, 0, [`${RAMP}@${toeTowards['+x']}`]),
            stack(1, 0, [`${RAMP}@${toeTowards['-x']}`]),
            stack(0, -1, [`${RAMP}@${toeTowards['+z']}`]),
            stack(0, 1, [`${RAMP}@${toeTowards['-z']}`]),
        ];
        const column = columnAt(columns(stacks), 0, 0);
        for (const side of column.sides) {
            assert.equal(side.landing, 'terrain');
            close(side.floorY, 0, 'toe');
            // The foam lies on the ramp, rising with it away from the water.
            assert.equal(side.skirt, true);
            close(side.skirtRise, 0.4, 'ramp slope');
        }
        // Raised water over a ramp's crest: the foam runs down the slope.
        const crest = columnAt(
            columns([
                stack(0, 0, [G, G, W]),
                stack(-1, 0, [`${RAMP}@${toeTowards['-x']}`]),
            ]),
            0,
            0,
        ).sides[0];
        close(crest.floorY, 0.4, 'crest');
        assert.equal(crest.skirt, true);
        close(crest.skirtRise, -0.4, 'down the slope');
    });

    it('falls on every side whose rim rounds over, beside any shaped block', () => {
        const shaped = [
            'Block_Grass_Angle',
            'Block_Grass_Corner',
            'Block_Grass_Reverse_Corner',
            'Block_Stone_Stairs',
            'Block_Stone_Stairs_Corner',
        ];
        const waters = [[W], [G, W], [G, G, W]];
        for (const name of shaped) {
            for (const water of waters) {
                for (let turns = 0; turns < 4; turns++) {
                    for (const base of [[], [G]]) {
                        const stacks = [
                            stack(0, 0, water),
                            stack(-1, 0, [...base, `${name}@${turns}`]),
                            stack(1, 0, [...base, `${name}@${turns}`]),
                            stack(0, -1, [...base, `${name}@${turns}`]),
                            stack(0, 1, [...base, `${name}@${turns}`]),
                        ];
                        const centre = stacks[0];
                        const top = centre?.blocks[centre.blocks.length - 1];
                        assert.ok(centre && top);
                        const rim = resolveWaterRimExposure({
                            block: top,
                            blockData,
                            stack: centre,
                            stacks,
                        });
                        const column = columnAt(columns(stacks), 0, 0);
                        const edges = [
                            rim.edges.x,
                            rim.edges.y,
                            rim.edges.z,
                            rim.edges.w,
                        ];
                        for (const [index, side] of column.sides.entries()) {
                            assert.equal(
                                side.landing !== 'none',
                                edges[index] === 1,
                                `${water.join(',')} beside ${base.join(',')} ${name}@${turns}, side ${index}`,
                            );
                            // A fall always lands below the water.
                            if (side.landing !== 'none') {
                                assert.ok(side.floorY < column.surfaceY - 0.02);
                            }
                        }
                    }
                }
            }
        }
    });

    it('spills water on a plinth over its support lip before it lands', () => {
        const plinth = columnAt(
            columns(lawn(-1, 1, -1, 1).set(0, 0, [G, G, W]).stacks()),
            0,
            0,
        );
        close(plinth.bottomY, 0.74, 'water bottom');
        assert.equal(plinth.supportTopY, 0.8);
        for (const side of plinth.sides) {
            assert.equal(side.landing, 'terrain');
            close(side.floorY, 0.4, 'lawn');
            assert.equal(side.spill, true);
            assert.equal(side.skirt, true);
        }
        // The spill turns each corner, so the foam rounds it too.
        assert.deepEqual(plinth.skirtCorners, [true, true, true, true]);
        // Water on a single block lands level with its support: no spill.
        const raised = columnAt(
            columns(lawn(-1, 1, -1, 1).set(0, 0, [G, W]).stacks()),
            0,
            0,
        );
        assert.ok(raised.sides.every((side) => !side.spill));
        // A plinth beside lower water spills onto that water.
        const ontoWater = columnAt(
            columns([stack(0, 0, [G, G, W]), stack(1, 0, [G, W])]),
            0,
            0,
        ).sides[1];
        assert.equal(ontoWater.landing, 'water');
        close(ontoWater.floorY, 0.74, 'lower water top');
        assert.equal(ontoWater.spill, true);
    });

    it('stands water that fills a ramp or corner on the block under it', () => {
        // Sides whose own bank rises to the water at each rotation: a
        // ramp's crest, a reverse corner's two high sides, none of a corner.
        const held: Record<string, readonly (readonly number[])[]> = {
            [RAMP]: [[1], [2], [0], [3]],
            Block_Grass_Corner: [[], [], [], []],
            Block_Grass_Reverse_Corner: [
                [1, 2],
                [0, 2],
                [0, 3],
                [1, 3],
            ],
        };
        for (const [filled, heldAt] of Object.entries(held)) {
            for (let turns = 0; turns < 4; turns++) {
                const shaped = `${filled}@${turns}`;
                const heldSides = heldAt[turns] ?? [];
                // In a lawn it falls from its surface (0.74) to the lawn,
                // which is as high as the block it stands on: no spill.
                const inLawn = columnAt(
                    columns(
                        lawn(-1, 1, -1, 1).set(0, 0, [G, shaped, W]).stacks(),
                    ),
                    0,
                    0,
                );
                const label = `${shaped} in a lawn`;
                close(inLawn.surfaceY, 0.74, `${label} surface`);
                close(inLawn.bottomY, 0.4, `${label} bottom`);
                close(
                    inLawn.supportTopY ?? Number.NaN,
                    0.4,
                    `${label} support`,
                );
                close(inLawn.runoutTopY, 0.4, `${label} run-out top`);
                for (const [index, side] of inLawn.sides.entries()) {
                    if (heldSides.includes(index)) {
                        assert.equal(side.landing, 'none', `${label} ${index}`);
                        continue;
                    }
                    assert.equal(side.landing, 'terrain', `${label} ${index}`);
                    close(side.floorY, 0.4, `${label} floor`);
                    assert.equal(side.spill, false, `${label} spill`);
                    assert.equal(side.skirt, true, `${label} skirt`);
                }
                // Filling a ramp at ground level, it stands on nothing: at
                // the island edge it runs off from its own bottom.
                const atEdge = columnAt(
                    columns(lawn(-1, 1, 0, 1).set(0, 0, [shaped, W]).stacks()),
                    0,
                    0,
                );
                const edgeLabel = `${shaped} at the island edge`;
                close(atEdge.surfaceY, 0.34, `${edgeLabel} surface`);
                assert.equal(atEdge.supportTopY, null, edgeLabel);
                close(atEdge.runoutTopY, 0, `${edgeLabel} run-out top`);
                assert.equal(atEdge.runoutOffset, waterfallGroundRunoutOffset);
                assert.equal(
                    atEdge.sides[2].landing,
                    heldSides.includes(2) ? 'none' : 'void',
                    edgeLabel,
                );
                // Sunk into the lawn on its other sides, it does not fall.
                assert.equal(atEdge.sides[3].landing, 'none', edgeLabel);
            }
        }
        // On a plinth under the ramp it spills over the plinth's lip,
        // except over the ramp's crest.
        const onPlinth = columnAt(
            columns(lawn(-1, 1, -1, 1).set(0, 0, [G, G, RAMP, W]).stacks()),
            0,
            0,
        );
        close(onPlinth.surfaceY, 1.14, 'plinth ramp surface');
        close(onPlinth.supportTopY ?? Number.NaN, 0.8, 'plinth top');
        assert.deepEqual(
            onPlinth.sides.map((side) => side.spill),
            [true, false, true, true],
        );
        assert.equal(onPlinth.sides[1].landing, 'none');
    });

    it('pours water stacked over the ramp or corner it fills over that block', () => {
        // The filled block's top along each side at rotation 0, in foam
        // edge order, from each side's start: a ramp rises to +x, a corner
        // peaks at +x/-z and a reverse corner dips at -x/+z.
        const low = [0.4, 0.4, 0.4, 0.4];
        const high = [0.8, 0.8, 0.8, 0.8];
        const rising = [0.4, 0.6, 0.6, 0.8];
        const falling = [0.8, 0.6, 0.6, 0.4];
        const lipsAtZero: Record<string, readonly (readonly number[])[]> = {
            [RAMP]: [low, high, rising, rising],
            Block_Grass_Corner: [low, falling, rising, low],
            Block_Grass_Reverse_Corner: [falling, high, high, rising],
        };
        for (const [filled, expected] of Object.entries(lipsAtZero)) {
            for (let turns = 0; turns < 4; turns++) {
                const shaped = `${filled}@${turns}`;
                const label = `[G,${shaped},W,W] in a lawn`;
                const column = columnAt(
                    columns(
                        lawn(-1, 1, -1, 1)
                            .set(0, 0, [G, shaped, W, W])
                            .stacks(),
                    ),
                    0,
                    0,
                );
                close(column.surfaceY, 1.14, `${label} surface`);
                close(column.bottomY, 0.4, `${label} bottom`);
                close(column.supportTopY ?? Number.NaN, 0.4, label);
                assert.equal(
                    column.runoutOffset,
                    waterfallSupportedRunoutOffset,
                );
                const lips = column.lips;
                assert.ok(lips, `${label} lips`);
                if (turns === 0) {
                    for (const [side, lip] of lips.entries()) {
                        for (const [index, height] of lip.entries()) {
                            close(
                                height,
                                expected[side]?.[index] ?? Number.NaN,
                                `${label} lip ${side}`,
                            );
                        }
                    }
                }
                for (const [side, lip] of lips.entries()) {
                    // A lip is level or straight, and meets the next
                    // side's lip at their shared corner.
                    close(lip[1], (lip[0] + lip[3]) / 2, `${label} straight`);
                    close(lip[2], lip[1], `${label} straight`);
                    const fall = column.sides[side];
                    // Nothing holds the water: it falls on every side,
                    // over the block's crest and slopes, and straight down
                    // where the block's top is as low as the lawn.
                    assert.equal(fall.landing, 'terrain', `${label} ${side}`);
                    close(fall.floorY, 0.4, `${label} floor`);
                    assert.equal(
                        fall.spill,
                        Math.max(...lip) > 0.4 + 1e-6,
                        `${label} spill ${side}`,
                    );
                    assert.equal(fall.skirt, true, `${label} skirt ${side}`);
                }
                for (const corner of [0, 1, 2, 3]) {
                    const [xSide, zSide] = [corner % 2, corner < 2 ? 2 : 3];
                    const xLip = lips[xSide];
                    const zLip = lips[zSide];
                    close(
                        xLip[corner < 2 ? 0 : 3],
                        zLip[corner % 2 === 0 ? 0 : 3],
                        `${label} corner ${corner}`,
                    );
                }
            }
        }
        // A ramp turned a quarter has its crest at -z.
        const turned = columnAt(
            columns(
                lawn(-1, 1, -1, 1)
                    .set(0, 0, [G, `${RAMP}@1`, W, W])
                    .stacks(),
            ),
            0,
            0,
        );
        closeAll(turned.lips?.[2], high, 'turned crest');
        // Water that only fills the ramp (surface 0.74, under its crest)
        // still pours over the block under the ramp, as before.
        const filledOnly = columnAt(
            columns(lawn(-1, 1, -1, 1).set(0, 0, [G, RAMP, W]).stacks()),
            0,
            0,
        );
        assert.ok(filledOnly.lips, 'filled-only lips');
        for (const [side, lip] of filledOnly.lips.entries()) {
            closeAll(lip, low, `filled-only lip ${side}`);
        }
        // At the island edge the run-out pours over the crest that faces
        // the void.
        const atEdge = columnAt(
            columns(
                lawn(-1, 1, 0, 1)
                    .set(0, 0, [G, `${RAMP}@1`, W, W])
                    .stacks(),
            ),
            0,
            0,
        );
        assert.equal(atEdge.sides[2].landing, 'void');
        closeAll(atEdge.lips?.[2], high, 'crest over the void');
        // At ground level the column stands on nothing, yet the ramp's
        // crest and slopes are lips its sheets pour over; its toe is the
        // ground.
        const onGround = columnAt(
            columns(
                lawn(-1, 1, 0, 1)
                    .set(0, 0, [`${RAMP}@1`, W, W])
                    .stacks(),
            ),
            0,
            0,
        );
        close(onGround.surfaceY, 0.74, 'ground ramp surface');
        assert.equal(onGround.supportTopY, null);
        close(onGround.runoutTopY, 0, 'ground ramp run-out top');
        assert.equal(onGround.runoutOffset, waterfallSupportedRunoutOffset);
        closeAll(onGround.lips?.[2], [0.4, 0.4, 0.4, 0.4], 'ground crest');
        closeAll(onGround.lips?.[3], [0, 0, 0, 0], 'ground toe');
        assert.equal(onGround.sides[2].landing, 'void');
    });

    it('changes the key when a ramp beside the water turns', () => {
        const turned = (turns: number) =>
            columnAt(
                columns(
                    lawn(-1, 1, -1, 1)
                        .set(0, 0, [G, W])
                        .set(0, -1, [G, `${RAMP}@${turns}`])
                        .stacks(),
                ),
                0,
                0,
            ).key;
        // Rotations 0 and 2 both show the ramp's side, sloping opposite ways.
        assert.notEqual(turned(0), turned(2));
    });

    it('gives each column a stable key that changes with its falls', () => {
        const before = columnAt(
            columns([stack(0, 0, [W, W]), stack(0, -1, [G])]),
            0,
            0,
        );
        const same = columnAt(
            columns([stack(0, 0, [W, W]), stack(0, -1, [G])]),
            0,
            0,
        );
        const changed = columnAt(
            columns([stack(0, 0, [W, W]), stack(0, -1, [G, G])]),
            0,
            0,
        );
        assert.equal(before.key, same.key);
        assert.notEqual(before.key, changed.key);
    });
});
