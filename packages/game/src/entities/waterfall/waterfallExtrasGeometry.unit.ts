import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BufferGeometry } from 'three';
import { ShaderLib, Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import { snowPresets } from '../../snow/snowPresets';
import { resolveSnowSettleAmountRange } from '../../snow/snowShader';
import type { Stack } from '../../types/Stack';
import {
    injectWaterBlockShader,
    resolveWaterfallLipSnowLift,
} from '../waterBlockMaterial';
import { waterRimRadius } from '../waterBlockRim';
import {
    createWaterfallExtrasGeometry,
    waterfallExtrasKind,
    waterfallRunoutFadeLength,
    waterfallSkirtWidth,
} from './waterfallExtrasGeometry';
import {
    resolveWaterfallColumns,
    waterfallIslandBaseY,
    waterfallSupportedRunoutOffset,
    waterfallVoidFloorY,
} from './waterfallPlacements';

const blockData = getLocalSandboxBlockData();
let nextId = 0;

/** A stack of blocks; `name@turns` turns a ramp (rising to +x at 0). */
function stack(x: number, z: number, names: string[]): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks: names.map((entry) => {
            const [name = entry, turns = '0'] = entry.split('@');
            return { id: `e${++nextId}`, name, rotation: Number(turns) };
        }),
    };
}

function lawnWith(extent: number, special: Record<string, string[]>): Stack[] {
    const stacks: Stack[] = [];
    for (let x = -extent; x <= extent; x++) {
        for (let z = -extent; z <= extent; z++) {
            stacks.push(stack(x, z, special[`${x}|${z}`] ?? ['Block_Grass']));
        }
    }
    return stacks;
}

function extrasFor(stacks: Stack[]) {
    return createWaterfallExtrasGeometry(
        resolveWaterfallColumns({ blockData, stacks }),
    );
}

type Vertex = {
    kind: number;
    normal: [number, number, number];
    position: [number, number, number];
    shape: [number, number, number, number];
};

function vertices(geometry: BufferGeometry): Vertex[] {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const shape = geometry.getAttribute('waterfallShape');
    return Array.from({ length: position.count }, (_, index) => ({
        kind: shape.getX(index),
        normal: [normal.getX(index), normal.getY(index), normal.getZ(index)],
        position: [
            position.getX(index),
            position.getY(index),
            position.getZ(index),
        ],
        shape: [
            shape.getX(index),
            shape.getY(index),
            shape.getZ(index),
            shape.getW(index),
        ],
    }));
}

function triangleCount(geometry: BufferGeometry) {
    return (geometry.getIndex()?.count ?? 0) / 3;
}

/** Distance from a point to the water's own tile, the square at 0,0. */
function outFromTile([x, , z]: [number, number, number]) {
    return Math.hypot(
        Math.max(Math.abs(x) - 0.5, 0),
        Math.max(Math.abs(z) - 0.5, 0),
    );
}

function isSkirt(vertex: Vertex) {
    return (
        vertex.kind === waterfallExtrasKind.terrainSkirt ||
        vertex.kind === waterfallExtrasKind.waterSkirt
    );
}

function windsAroundNormals(geometry: BufferGeometry) {
    const all = vertices(geometry);
    const index = geometry.getIndex();
    assert.ok(index);
    const at = (corner: number) => {
        const vertex = all[corner];
        assert.ok(vertex);
        return {
            normal: new Vector3(...vertex.normal),
            position: new Vector3(...vertex.position),
        };
    };
    for (let i = 0; i < index.count; i += 3) {
        const a = at(index.getX(i));
        const b = at(index.getX(i + 1));
        const c = at(index.getX(i + 2));
        const ab = b.position.clone().sub(a.position);
        const ac = c.position.clone().sub(a.position);
        const facing = ab
            .cross(ac)
            .dot(a.normal.clone().add(b.normal).add(c.normal));
        assert.ok(facing >= -1e-9, `triangle ${i / 3} faces its normals`);
    }
}

function close(actual: number, expected: number, message: string) {
    assert.ok(
        Math.abs(actual - expected) < 1e-6,
        `${message}: ${actual} != ${expected}`,
    );
}

describe('createWaterfallExtrasGeometry', () => {
    it('adds nothing for water with no fall', () => {
        const geometry = extrasFor(lawnWith(1, { '0|0': ['Block_Water'] }));
        assert.equal(triangleCount(geometry), 0);
        geometry.dispose();
    });

    it('runs a lone ground-level block off the island on every side and corner', () => {
        const geometry = extrasFor([stack(0, 0, ['Block_Water'])]);
        const all = vertices(geometry);
        assert.ok(
            all.every((vertex) => vertex.kind === waterfallExtrasKind.runout),
        );
        // Four straight sheets and four rounded corners of four steps.
        assert.equal(triangleCount(geometry), (4 + 4 * 4) * 2);
        const ys = all.map((vertex) => vertex.position[1]);
        // It starts a little up the wall so no sky shows at the seam, and
        // fades out below the island base.
        assert.ok(Math.max(...ys) > waterfallIslandBaseY);
        close(
            Math.min(...ys),
            waterfallIslandBaseY - waterfallRunoutFadeLength,
            'bottom',
        );
        // The bottom leans out, as falling water arcs away.
        const bottomReach = Math.max(
            ...all
                .filter((vertex) => vertex.position[1] < -0.3)
                .map((vertex) => Math.abs(vertex.position[0])),
        );
        assert.ok(bottomReach > 0.5 + 0.03);
        geometry.dispose();
    });

    it('lays a skirt on all four sides of raised water with patches round the corners', () => {
        const geometry = extrasFor(
            lawnWith(1, { '0|0': ['Block_Grass', 'Block_Water'] }),
        );
        const all = vertices(geometry);
        assert.ok(
            all.every(
                (vertex) => vertex.kind === waterfallExtrasKind.terrainSkirt,
            ),
        );
        // One quad per side (both ends turn a corner) and four corner patches.
        assert.equal(triangleCount(geometry), 8 * 2);
        for (const vertex of all) {
            close(vertex.position[1], 0.406, 'skirt height');
            assert.deepEqual(vertex.normal, [0, 1, 0]);
            const reach = Math.hypot(vertex.shape[1], vertex.shape[2]);
            assert.ok(reach <= Math.SQRT2 * waterfallSkirtWidth + 1e-6);
            // Every point of the skirt lies outside the water's tile.
            const [x, , z] = vertex.position;
            assert.ok(Math.max(Math.abs(x), Math.abs(z)) >= 0.5 - 1e-6);
        }
        geometry.dispose();
    });

    it('tapers a skirt that nothing continues', () => {
        const geometry = extrasFor([
            stack(0, 0, ['Block_Water', 'Block_Water']),
            stack(0, -1, ['Block_Grass']),
        ]);
        const skirt = vertices(geometry).filter(
            (vertex) => vertex.kind === waterfallExtrasKind.terrainSkirt,
        );
        // Three stretches: taper, full, taper.
        assert.equal(skirt.length, 3 * 4);
        const ends = skirt.filter(
            (vertex) => Math.abs(Math.abs(vertex.position[0]) - 0.5) < 1e-6,
        );
        assert.ok(ends.length > 0);
        assert.ok(ends.every((vertex) => vertex.shape[3] === 0));
        assert.ok(skirt.some((vertex) => vertex.shape[3] === 1));
        geometry.dispose();
    });

    it('mitres two skirts that land on the same tile from two sides', () => {
        const geometry = extrasFor(
            lawnWith(2, {
                '0|0': ['Block_Grass', 'Block_Water'],
                '1|0': ['Block_Grass', 'Block_Water'],
                '0|1': ['Block_Grass', 'Block_Water'],
            }),
        );
        const skirt = vertices(geometry).filter(
            (vertex) => vertex.kind === waterfallExtrasKind.terrainSkirt,
        );
        // Inside the inner-corner square of tile (1, 1), no skirt point lies
        // on the far side of the diagonal from its own wall, so the two
        // never overlap.
        const inCorner = skirt.filter(
            ({ position: [x, , z] }) =>
                x > 0.5 + 1e-6 &&
                x < 0.5 + waterfallSkirtWidth + 1e-6 &&
                z > 0.5 + 1e-6 &&
                z < 0.5 + waterfallSkirtWidth + 1e-6,
        );
        assert.ok(inCorner.length > 0, 'mitred corners present');
        for (const vertex of inCorner) {
            const [x, , z] = vertex.position;
            // On the diagonal: as far from one wall as from the other.
            close(x - 0.5, z - 0.5, 'mitre on the diagonal');
        }
        geometry.dispose();
    });

    it('pours raised water at the island edge over its support lip', () => {
        const stacks = lawnWith(1, {}).filter(
            (candidate) => candidate.position.z >= 0,
        );
        const index = stacks.findIndex(
            (candidate) =>
                candidate.position.x === 0 && candidate.position.z === 0,
        );
        stacks[index] = stack(0, 0, ['Block_Grass', 'Block_Water']);
        const geometry = extrasFor(stacks);
        const runout = vertices(geometry).filter(
            (vertex) => vertex.kind === waterfallExtrasKind.runout,
        );
        assert.ok(runout.length > 0);
        // It leaves the wall above the support top (0.4) and swells out
        // over the grass lip (reach 0.07, 0.07 deep), falling on outside it.
        const top = Math.max(...runout.map((vertex) => vertex.position[1]));
        assert.ok(top > 0.4, 'starts above the lip');
        const wallTop = runout.filter(
            (vertex) => Math.abs(vertex.position[1] - top) < 1e-6,
        );
        assert.ok(
            wallTop.every(
                (vertex) => Math.abs(vertex.position[2] + 0.5) < 1e-6,
            ),
        );
        for (const vertex of runout) {
            const [, y, z] = vertex.position;
            const out = -0.5 - z;
            if (y <= 0.4 - 0.07 + 1e-6) {
                assert.ok(
                    out >= waterfallSupportedRunoutOffset - 1e-6,
                    'below the lip',
                );
            }
            // Never inside the lip's quarter round (centre 0.07 under the
            // top, radius 0.07).
            assert.ok(
                Math.hypot(out, y - (0.4 - 0.07)) >= 0.07 - 1e-6 || out <= 0,
                `clear of the lip at ${out.toFixed(3)}, ${y.toFixed(3)}`,
            );
        }
        geometry.dispose();
    });

    it('wraps the rounded grass corner of a support block at an island corner', () => {
        const geometry = extrasFor([
            stack(0, 0, ['Block_Grass', 'Block_Water']),
            stack(1, 0, ['Block_Grass']),
            stack(0, 1, ['Block_Grass']),
            stack(1, 1, ['Block_Grass']),
        ]);
        const corner = vertices(geometry).filter(
            ({ kind, position: [x, , z] }) =>
                kind === waterfallExtrasKind.runout && x < -0.5 && z < -0.5,
        );
        assert.ok(corner.length > 0, 'the corner is rounded');
        for (const {
            position: [x, y, z],
        } of corner) {
            // The grass lip rounds about the tile corner with a reach of
            // 0.07; below the support top the fall stays outside it.
            if (y <= 0.4 - 0.04 + 1e-6) {
                assert.ok(Math.hypot(x + 0.5, z + 0.5) >= 0.07);
            }
        }
        geometry.dispose();
    });

    it('pours water on a plinth over its support lip down to the lawn', () => {
        const geometry = extrasFor(
            lawnWith(1, {
                '0|0': ['Block_Grass', 'Block_Grass', 'Block_Water'],
            }),
        );
        const all = vertices(geometry);
        const spill = all.filter(
            (vertex) => vertex.kind === waterfallExtrasKind.spill,
        );
        assert.ok(spill.length > 0, 'a spill sheet');
        const ys = spill.map((vertex) => vertex.position[1]);
        // From above the support's grass lip (top 0.8) to the lawn (0.4).
        assert.ok(Math.max(...ys) > 0.8);
        close(Math.min(...ys), 0.4, 'lands on the lawn');
        for (const vertex of spill) {
            const [, y] = vertex.position;
            close(vertex.shape[1], 0.4, 'floor');
            close(vertex.shape[3], 0.8, 'sheet top');
            // Below the lip it hangs clear of the lip's reach.
            if (y <= 0.8 - 0.04 + 1e-6) {
                assert.ok(
                    outFromTile(vertex.position) >=
                        waterfallSupportedRunoutOffset - 1e-6,
                    `clear of the lip at ${vertex.position.join(',')}`,
                );
            }
        }
        // The foam starts at the sheet's foot, round the corners too.
        const skirt = all.filter(isSkirt);
        assert.ok(skirt.length > 0);
        for (const vertex of skirt) {
            const out = outFromTile(vertex.position);
            assert.ok(out >= waterfallSupportedRunoutOffset - 1e-6);
            close(
                out - waterfallSupportedRunoutOffset,
                vertex.shape[1],
                'offset from the foot',
            );
            close(vertex.position[1], 0.406, 'skirt height');
        }
        windsAroundNormals(geometry);
        geometry.dispose();
    });

    it('draws the foam before the sheets that stand in front of it', () => {
        const geometry = extrasFor(
            lawnWith(1, {
                '0|0': ['Block_Grass', 'Block_Grass', 'Block_Water'],
            }),
        );
        const all = vertices(geometry);
        const index = geometry.getIndex();
        assert.ok(index);
        const kinds = Array.from({ length: index.count / 3 }, (_, triangle) => {
            const vertex = all[index.getX(triangle * 3)];
            assert.ok(vertex);
            return isSkirt(vertex);
        });
        const lastSkirt = kinds.lastIndexOf(true);
        const firstSheet = kinds.indexOf(false);
        assert.ok(lastSkirt >= 0 && firstSheet >= 0);
        assert.ok(lastSkirt < firstSheet);
        geometry.dispose();
    });

    it('follows a slope where a spill lands beside a ramp', () => {
        // A plinth with a ramp side-on at -z, rising from 0.4 to 0.8 to +x.
        const geometry = extrasFor([
            stack(0, 0, ['Block_Grass', 'Block_Grass', 'Block_Water']),
            stack(0, -1, ['Block_Grass', 'Block_Grass_Angle']),
        ]);
        const foot = vertices(geometry).filter(
            ({ kind, position: [x, y, z] }) =>
                kind === waterfallExtrasKind.spill &&
                z < -0.5 &&
                Math.abs(x) <= 0.5 + 1e-6 &&
                y < 0.76 - 1e-6,
        );
        assert.ok(foot.length > 0);
        for (const {
            position: [x, y],
            shape,
        } of foot) {
            // It lands on the slope, and never rises above the lip.
            close(shape[1], 0.6 + 0.4 * x, 'floor under it');
            close(y, Math.min(0.6 + 0.4 * x, 0.76), 'foot height');
        }
        // No foam on the slope.
        assert.ok(
            vertices(geometry).every(
                ({ kind, position: [, , z] }) =>
                    !(kind === waterfallExtrasKind.terrainSkirt && z < -0.5),
            ),
        );
        geometry.dispose();
    });

    it('tucks a spill under the snow of higher ground beside its lip', () => {
        // A plinth with a ramp crest at -x (0.8, no spill), a ramp side-on
        // at -z (0.4 to 0.8 towards +x) and a ramp toe at +x (0.4).
        const geometry = extrasFor(
            lawnWith(2, {
                '-1|0': ['Block_Grass', 'Block_Grass_Angle'],
                '0|-1': ['Block_Grass', 'Block_Grass_Angle'],
                '0|0': ['Block_Grass', 'Block_Grass', 'Block_Water'],
                '1|0': ['Block_Grass', 'Block_Grass_Angle'],
            }),
        );
        const spill = vertices(geometry).filter(
            ({ kind }) => kind === waterfallExtrasKind.spill,
        );
        assert.ok(spill.length > 0);
        // The lift's ground is never below the landing.
        for (const { shape } of spill) assert.ok(shape[2] >= shape[1] - 1e-6);
        // The +z spill ends at the crest: there its lift's ground is the
        // crest, a fade length in it is the lawn again.
        const plusZ = spill.filter(({ position: [, , z] }) => z > 0.5);
        const crestEnd = plusZ.filter(({ position: [x] }) => x < -0.5 + 1e-6);
        const inside = plusZ.filter(
            ({ position: [x] }) => Math.abs(x + 0.35) < 1e-6,
        );
        assert.ok(crestEnd.length > 0 && inside.length > 0);
        for (const { shape } of crestEnd) close(shape[2], 0.8, 'crest');
        for (const { shape } of inside) close(shape[2], 0.4, 'lawn');
        // Round the (+x,-z) corner it tucks under the ramp's high end, and
        // a fade length along the toe side it lifts over the lip again.
        const corner = spill.filter(
            ({ position: [x, , z] }) => x > 0.44 && z < -0.44,
        );
        assert.ok(corner.length > 0);
        for (const { shape } of corner) close(shape[2], 0.8, 'high end');
        const toe = spill.filter(
            ({ position: [x, , z] }) => x > 0.5 && Math.abs(z + 0.35) < 1e-6,
        );
        assert.ok(toe.length > 0);
        for (const { shape } of toe) close(shape[2], 0.4, 'toe');
        geometry.dispose();
    });

    it('lifts a spill onto lower water fully, as water holds no snow', () => {
        // A plinth beside lower raised water at +x, lawn elsewhere.
        const geometry = extrasFor(
            lawnWith(1, {
                '0|0': ['Block_Grass', 'Block_Grass', 'Block_Water'],
                '1|0': ['Block_Grass', 'Block_Water'],
            }),
        );
        const ontoWater = vertices(geometry).filter(
            ({ kind, position: [x, , z] }) =>
                kind === waterfallExtrasKind.spill &&
                x > 0.5 &&
                Math.abs(z) < 0.4,
        );
        assert.ok(ontoWater.length > 0);
        for (const { shape } of ontoWater) {
            assert.ok(shape[1] > 0.4, 'lands on the water');
            assert.equal(shape[2], waterfallVoidFloorY, 'no snowy ground');
        }
        geometry.dispose();
    });

    it('lifts a plinth spill over lawn all round, with no fade', () => {
        const geometry = extrasFor(
            lawnWith(1, {
                '0|0': ['Block_Grass', 'Block_Grass', 'Block_Water'],
            }),
        );
        for (const { kind, shape } of vertices(geometry)) {
            if (kind === waterfallExtrasKind.spill) {
                close(shape[2], shape[1], 'lift ground is the lawn');
            }
        }
        geometry.dispose();
    });

    it('tilts the foam with a ramp whose toe meets a ground pond', () => {
        // The ramp at +x rises away from the water: its toe (the -x side at
        // rotation 0) meets the pond at the ground.
        const geometry = extrasFor([
            stack(0, 0, ['Block_Water']),
            stack(1, 0, ['Block_Grass_Angle']),
        ]);
        const skirt = vertices(geometry).filter(isSkirt);
        assert.ok(skirt.length > 0);
        for (const {
            normal,
            position: [x, y],
        } of skirt) {
            close(y, 0.006 + 0.4 * (x - 0.5), 'on the slope');
            // Tilted back towards the water, as the ramp's top is.
            assert.ok(normal[0] < 0 && normal[1] > 0.9);
        }
        windsAroundNormals(geometry);
        geometry.dispose();
    });

    it('keeps every piece below the water it falls from, even lifted over snow', () => {
        // The most the vertex shader lifts a sheet's shoulder over lip snow.
        const snowLift = resolveWaterfallLipSnowLift(1, 1);
        const supports = [
            'Block_Grass',
            'Block_Grass_Angle',
            'Block_Grass_Corner',
            'Block_Grass_Reverse_Corner',
            'Block_Stone_Stairs',
        ];
        const places: Record<string, (column: Stack) => Stack[]> = {
            alone: (column) => [column],
            'in a lawn': (column) =>
                lawnWith(1, {}).map((candidate) =>
                    candidate.position.x === 0 && candidate.position.z === 0
                        ? column
                        : candidate,
                ),
            'at the island edge': (column) =>
                lawnWith(1, {})
                    .filter((candidate) => candidate.position.z >= 0)
                    .map((candidate) =>
                        candidate.position.x === 0 && candidate.position.z === 0
                            ? column
                            : candidate,
                    ),
        };
        let checked = 0;
        for (const support of supports) {
            for (const base of [
                [],
                ['Block_Grass'],
                ['Block_Grass', 'Block_Grass'],
            ]) {
                for (const water of [
                    ['Block_Water'],
                    ['Block_Water', 'Block_Water'],
                ]) {
                    for (let turns = 0; turns < 4; turns++) {
                        for (const [place, build] of Object.entries(places)) {
                            const names = [
                                ...base,
                                `${support}@${turns}`,
                                ...water,
                            ];
                            const stacks = build(stack(0, 0, names));
                            const columns = resolveWaterfallColumns({
                                blockData,
                                stacks,
                            });
                            const [column] = columns;
                            assert.equal(columns.length, 1);
                            assert.ok(column);
                            const geometry =
                                createWaterfallExtrasGeometry(columns);
                            for (const vertex of vertices(geometry)) {
                                const y = vertex.position[1];
                                assert.ok(
                                    y + snowLift < column.surfaceY - 0.05,
                                    `${names.join(',')} ${place}: ${y.toFixed(3)} under ${column.surfaceY.toFixed(3)}`,
                                );
                                checked += 1;
                            }
                            geometry.dispose();
                        }
                    }
                }
            }
        }
        assert.ok(checked > 0);
    });

    it('fills a ramp with water that falls only from its low sides', () => {
        // Water on a corner on a block falls down its wall onto the lawn
        // over the corner's two low sides (-x and +z at rotation 0); the
        // bank's sloping sides hold it.
        const kinds = (geometry: BufferGeometry) =>
            new Set(vertices(geometry).map((vertex) => vertex.kind));
        const onCorner = extrasFor(
            lawnWith(1, {
                '0|0': ['Block_Grass', 'Block_Grass_Corner', 'Block_Water'],
            }),
        );
        const onBlock = extrasFor(
            lawnWith(1, { '0|0': ['Block_Grass', 'Block_Water'] }),
        );
        assert.deepEqual(
            kinds(onCorner),
            new Set([waterfallExtrasKind.terrainSkirt]),
        );
        assert.ok(triangleCount(onCorner) < triangleCount(onBlock));
        const cornerSkirts = vertices(onCorner).filter(isSkirt);
        assert.ok(cornerSkirts.length > 0);
        assert.ok(
            cornerSkirts.every(
                (vertex) =>
                    vertex.position[0] < -0.5 + 1e-6 ||
                    vertex.position[2] > 0.5 - 1e-6,
            ),
            'foam only below the low sides',
        );
        onCorner.dispose();
        onBlock.dispose();
        // A ramp (rising to +x at rotation 0) holds its water on its crest
        // and both slopes: foam lies only at the foot of its toe.
        const onRamp = extrasFor(
            lawnWith(1, {
                '0|0': ['Block_Grass', 'Block_Grass_Angle', 'Block_Water'],
            }),
        );
        const skirts = vertices(onRamp).filter(isSkirt);
        assert.ok(skirts.length > 0);
        assert.deepEqual(
            kinds(onRamp),
            new Set([waterfallExtrasKind.terrainSkirt]),
        );
        assert.ok(
            skirts.every((vertex) => vertex.position[0] < -0.5 + 1e-6),
            'foam only below the toe',
        );
        onRamp.dispose();
        // At ground level with its toe on the island edge, it runs off from
        // its bottom (the ramp's base), hugging the wall, with no lip to
        // pour over.
        const atEdge = extrasFor(
            lawnWith(1, { '0|0': ['Block_Grass_Angle', 'Block_Water'] }).filter(
                (candidate) => candidate.position.x >= 0,
            ),
        );
        const runout = vertices(atEdge).filter(
            (vertex) => vertex.kind === waterfallExtrasKind.runout,
        );
        assert.ok(runout.length > 0);
        assert.ok(
            runout.every((vertex) => vertex.position[0] < -0.5 + 1e-6),
            'runs off the toe only',
        );
        // A sloping side on the island edge holds its water.
        const slopeAtEdge = extrasFor(
            lawnWith(1, { '0|0': ['Block_Grass_Angle', 'Block_Water'] }).filter(
                (candidate) => candidate.position.z >= 0,
            ),
        );
        assert.equal(vertices(slopeAtEdge).length, 0);
        slopeAtEdge.dispose();
        const top = Math.max(...runout.map((vertex) => vertex.position[1]));
        assert.ok(top > 0 && top < 0.05, `run-out top ${top}`);
        for (const vertex of runout) {
            close(vertex.shape[3], waterfallIslandBaseY, 'no lip to lift');
        }
        atEdge.dispose();
    });

    it('pours water stacked over a filled ramp over the ramp, not behind it', () => {
        // The ramp rises to +x: its crest is 0.8 high, its -z and +z sides
        // slope from 0.4 to 0.8 and its toe (-x) meets the lawn at 0.4.
        const geometry = extrasFor(
            lawnWith(1, {
                '0|0': [
                    'Block_Grass',
                    'Block_Grass_Angle',
                    'Block_Water',
                    'Block_Water',
                ],
            }),
        );
        const all = vertices(geometry);
        const spill = all.filter(
            (vertex) => vertex.kind === waterfallExtrasKind.spill,
        );
        const lipAt = ([x, , z]: [number, number, number]) =>
            x >= 0.5 ? 0.8 : Math.abs(z) >= 0.5 ? 0.4 + 0.4 * (x + 0.5) : 0.4;
        const crest = spill.filter(
            ({ position: [x, , z] }) => x > 0.5 - 1e-6 && Math.abs(z) < 0.5,
        );
        assert.ok(crest.length > 0, 'a spill over the crest');
        // From just above the crest's grass lip down to the lawn.
        close(
            Math.max(...crest.map((vertex) => vertex.position[1])),
            0.86,
            'crest spill top',
        );
        for (const vertex of crest) close(vertex.shape[3], 0.8, 'crest lip');
        const slope = spill.filter(
            ({ position: [x, , z] }) => z < -0.5 && Math.abs(x) <= 0.5,
        );
        assert.ok(slope.length > 0, 'a spill over the slope');
        for (const vertex of slope) {
            // Where the sheet turns the corner, short of the tile corner by
            // the rim's radius, it carries the corner's lip.
            assert.ok(
                Math.abs(vertex.shape[3] - lipAt(vertex.position)) <=
                    0.4 * waterRimRadius + 1e-6,
                `sloped lip at ${vertex.position.join(',')}`,
            );
        }
        for (const vertex of spill) {
            const [, y] = vertex.position;
            // Below its lip, the sheet hangs clear of the lip's reach.
            if (y <= lipAt(vertex.position) - 0.04 - 1e-6) {
                assert.ok(
                    outFromTile(vertex.position) >=
                        waterfallSupportedRunoutOffset - 1e-6,
                    `clear of the lip at ${vertex.position.join(',')}`,
                );
            }
            assert.ok(y >= 0.36 - 1e-6 && y <= 0.86 + 1e-6);
        }
        // No spill over the toe: its fall lands straight on the lawn, with
        // foam at the wall, while the foam of the spills starts at their
        // foot.
        assert.ok(
            spill.every(({ position: [x] }) => x > -0.5 - 1e-6),
            'no spill over the toe',
        );
        const skirts = all.filter(isSkirt);
        const toeSkirt = skirts.filter(
            ({ position: [x, , z] }) => x < -0.5 && Math.abs(z) <= 0.5 + 1e-6,
        );
        assert.ok(toeSkirt.length > 0);
        for (const vertex of toeSkirt) {
            close(outFromTile(vertex.position), vertex.shape[1], 'at the wall');
        }
        const crestSkirt = skirts.filter(
            ({ position: [x, , z] }) => x > 0.5 && Math.abs(z) <= 0.5 + 1e-6,
        );
        assert.ok(crestSkirt.length > 0);
        for (const vertex of crestSkirt) {
            close(
                outFromTile(vertex.position) - waterfallSupportedRunoutOffset,
                vertex.shape[1],
                'at the foot of the spill',
            );
        }
        windsAroundNormals(geometry);
        geometry.dispose();

        // At the island edge, the run-out pours over the crest facing the
        // void (a ramp turned a quarter has its crest at -z).
        const atEdge = extrasFor(
            lawnWith(1, {
                '0|0': [
                    'Block_Grass',
                    'Block_Grass_Angle@1',
                    'Block_Water',
                    'Block_Water',
                ],
            }).filter((candidate) => candidate.position.z >= 0),
        );
        const runout = vertices(atEdge).filter(
            ({ kind, position: [x, , z] }) =>
                kind === waterfallExtrasKind.runout &&
                z < -0.5 + 1e-6 &&
                Math.abs(x) < 0.5,
        );
        assert.ok(runout.length > 0);
        close(
            Math.max(...runout.map((vertex) => vertex.position[1])),
            0.86,
            'run-out top',
        );
        for (const vertex of runout) {
            close(vertex.shape[3], 0.8, 'crest lip');
            if (vertex.position[1] <= 0.8 - 0.04 - 1e-6) {
                assert.ok(
                    -0.5 - vertex.position[2] >=
                        waterfallSupportedRunoutOffset - 1e-6,
                    'clear of the crest',
                );
            }
        }
        windsAroundNormals(atEdge);
        atEdge.dispose();
    });

    it('meets a stacked spill over a corner or reverse corner at its corners', () => {
        for (const filled of [
            'Block_Grass_Corner',
            'Block_Grass_Reverse_Corner',
        ]) {
            for (let turns = 0; turns < 4; turns++) {
                const stacks = lawnWith(1, {
                    '0|0': [
                        'Block_Grass',
                        `${filled}@${turns}`,
                        'Block_Water',
                        'Block_Water',
                    ],
                });
                const [column] = resolveWaterfallColumns({ blockData, stacks });
                assert.ok(column?.lips);
                const geometry = createWaterfallExtrasGeometry([column]);
                const spill = vertices(geometry).filter(
                    (vertex) => vertex.kind === waterfallExtrasKind.spill,
                );
                assert.ok(spill.length > 0, `${filled}@${turns} spills`);
                for (const vertex of spill) {
                    const [x, y, z] = vertex.position;
                    const lip = vertex.shape[3];
                    // Every ring sits on the lip below it: from 0.06 above
                    // it down to the lawn, at most 0.04 under the lip.
                    assert.ok(lip >= 0.4 - 1e-6 && lip <= 0.8 + 1e-6);
                    assert.ok(y <= lip + 0.06 + 1e-6, `${filled} under`);
                    // Out past a tile corner, the lip is that corner's.
                    if (Math.abs(x) > 0.5 && Math.abs(z) > 0.5) {
                        const corner = (x > 0 ? 1 : 0) + (z > 0 ? 2 : 0);
                        const xLip = column.lips[x > 0 ? 1 : 0];
                        close(
                            lip,
                            xLip[corner < 2 ? 0 : 3],
                            `${filled}@${turns} corner lip`,
                        );
                    }
                }
                windsAroundNormals(geometry);
                geometry.dispose();
            }
        }
    });

    it('winds every triangle around its normals', () => {
        const geometry = extrasFor([
            stack(0, 0, ['Block_Water', 'Block_Water']),
            stack(0, -1, ['Block_Grass']),
        ]);
        windsAroundNormals(geometry);
        geometry.dispose();
    });
});

describe('waterfall lip snow', () => {
    const grass = snowPresets.grassFlat;
    const [dusting, settled] = resolveSnowSettleAmountRange(
        grass.settleCm,
        grass.coverageMultiplier,
    );

    it('lifts a spill only once the snow on its lip has grown thick', () => {
        const plinth = 0.96;
        assert.equal(resolveWaterfallLipSnowLift(0, plinth), 0);
        assert.equal(resolveWaterfallLipSnowLift(dusting, plinth), 0);
        let previous = 0;
        for (let step = 0; step <= 20; step++) {
            const lift = resolveWaterfallLipSnowLift(step / 20, plinth);
            assert.ok(lift >= previous - 1e-9);
            previous = lift;
        }
        // Over the thickest grass snow (its noise peaks 35% over the
        // preset's thickness) once the cover is full.
        assert.ok(resolveWaterfallLipSnowLift(settled, plinth) > 0);
        assert.ok(
            resolveWaterfallLipSnowLift(1, plinth) >= grass.maxThickness * 1.35,
        );
    });

    it('keeps a spill under the snow where its landing is as high as the lip', () => {
        assert.equal(resolveWaterfallLipSnowLift(1, 0), 0);
        assert.equal(resolveWaterfallLipSnowLift(1, -0.2), 0);
        const low = resolveWaterfallLipSnowLift(1, 0.03);
        const high = resolveWaterfallLipSnowLift(1, 0.1);
        assert.ok(low > 0 && low < high);
        assert.equal(
            resolveWaterfallLipSnowLift(1, 0.5),
            resolveWaterfallLipSnowLift(1, 0.96),
        );
    });

    it('moves the sheet in the vertex shader before it is projected', () => {
        const shader = {
            fragmentShader: ShaderLib.standard.fragmentShader,
            uniforms: {},
            vertexShader: ShaderLib.standard.vertexShader,
        };
        injectWaterBlockShader(shader, {});

        const begin = shader.vertexShader.indexOf('#include <begin_vertex>');
        const lift = shader.vertexShader.indexOf('transformed.y += lipSnow;');
        const project = shader.vertexShader.indexOf(
            '#include <project_vertex>',
        );
        assert.ok(begin >= 0 && lift > begin && project > lift);
        assert.match(shader.vertexShader, /uniform float uWaterfallSnow;/);
    });
});
