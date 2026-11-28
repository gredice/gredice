import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ShaderLib, Vector4 } from 'three';
import { waterSideInstancesEqual } from '../retainedWaterChunks';
import { createMergedWaterSideGeometry } from '../waterBlockGeometry';
import {
    createWaterBlockMaterial,
    injectWaterBlockShader,
    type WaterBlockMaterialSettings,
} from '../waterBlockMaterial';
import {
    levelWaterfallFloor,
    levelWaterfallFloors,
    type WaterfallFloors,
} from './waterfallFloorProfile';

function settings(
    overrides: Partial<WaterBlockMaterialSettings> = {},
): WaterBlockMaterialSettings {
    return {
        discardInnerEdges: false,
        foamCorners: new Vector4(0, 0, 0, 0),
        foamEdges: new Vector4(0, 0, 0, 0),
        style: 'standard',
        timeUniform: { value: 0 },
        useFoamAttributes: false,
        useLocalPositionAttribute: false,
        useShoreDepthAttribute: false,
        useWaterDepthAttribute: true,
        waterDepth: 1,
        waterTopLocalY: 0.2,
        ...overrides,
    };
}

type Vec3 = [number, number, number];

function close(actual: number, expected: number) {
    assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
}

const exposed = { w: 1, x: 1, y: 1, z: 1 };
/** Only the -z side is exposed, so that wall runs corner to corner. */
const negZOnly = { w: 0, x: 0, y: 0, z: 1 };

/** Floor of every vertex of the walls facing -z, by its x. */
function negZFloors(floors: WaterfallFloors, positions: Vec3[]) {
    const geometry = createMergedWaterSideGeometry(
        positions.map((position) => ({
            fallFloors: floors,
            position,
            rimEdges: negZOnly,
            surfaceY: position[1] + 0.2,
            waterHeight: 0.4,
        })),
    );
    const floor = geometry.getAttribute('waterFallFloor');
    const normal = geometry.getAttribute('normal');
    const position = geometry.getAttribute('position');
    const result: { floor: number; x: number }[] = [];
    for (let vertex = 0; vertex < position.count; vertex++) {
        if (normal.getZ(vertex) < -0.99) {
            result.push({
                floor: floor.getX(vertex),
                x: position.getX(vertex),
            });
        }
    }
    const faces = result.length / 4;
    geometry.dispose();
    return { faces, vertices: result };
}

describe('waterfall walls', () => {
    it('carries each side floor on the wall, and the lower floor on a corner', () => {
        const floors: WaterfallFloors = [
            levelWaterfallFloor(0.4),
            levelWaterfallFloor(-64),
            levelWaterfallFloor(0.74),
            levelWaterfallFloor(0.74),
        ];
        const geometry = createMergedWaterSideGeometry([
            {
                fallFloors: floors,
                position: [0, 0.54, 0],
                rimEdges: exposed,
                surfaceY: 0.74,
                waterHeight: 0.4,
            },
        ]);
        const floor = geometry.getAttribute('waterFallFloor');
        const normal = geometry.getAttribute('normal');
        const index = geometry.getIndex();
        assert.ok(floor, 'floor attribute present');
        assert.ok(index);
        // Flat wall triangles by their normal; rounded corner triangles,
        // whose normals turn, under 'corner'.
        const bySide = new Map<string, Set<number>>();
        for (let i = 0; i < index.count; i += 3) {
            const corners = [0, 1, 2].map((k) => index.getX(i + k));
            const keys = corners.map((vertex) =>
                [normal.getX(vertex), normal.getZ(vertex)]
                    .map((value) => Math.round(value * 100) / 100)
                    .join(','),
            );
            const key = keys.every((value) => value === keys[0])
                ? (keys[0] ?? '')
                : 'corner';
            const set = bySide.get(key) ?? new Set<number>();
            for (const vertex of corners) {
                set.add(Math.round(floor.getX(vertex) * 1000) / 1000);
            }
            bySide.set(key, set);
        }
        assert.deepEqual([...(bySide.get('-1,0') ?? [])], [0.4]);
        assert.deepEqual([...(bySide.get('1,0') ?? [])], [-64]);
        assert.deepEqual([...(bySide.get('0,-1') ?? [])], [0.74]);
        assert.deepEqual([...(bySide.get('0,1') ?? [])], [0.74]);
        // Each rounded corner falls as far as the lower of its two sides:
        // 0.4 at (-x,-z) and (-x,+z), off the edge at (+x,-z) and (+x,+z).
        assert.deepEqual(
            [...(bySide.get('corner') ?? [])].sort((a, b) => a - b),
            [-64, 0.4],
        );
        geometry.dispose();
    });

    it('lands along a slope beside the wall, end to end', () => {
        // A ramp side-on at -z, rising from 0.4 at -x to 0.8 at +x.
        const slope: WaterfallFloors = [
            levelWaterfallFloor(0.74),
            levelWaterfallFloor(0.74),
            [0.4, 0.6, 0.6, 0.8],
            levelWaterfallFloor(0.74),
        ];
        const { faces, vertices } = negZFloors(slope, [[0, 0.54, 0]]);
        assert.equal(faces, 1);
        for (const { floor, x } of vertices) {
            assert.ok(
                Math.abs(floor - (0.4 + 0.4 * (x + 0.5))) < 1e-6,
                `floor ${floor} at x ${x}`,
            );
        }
    });

    it('splits the wall where a stair step jumps', () => {
        const step: WaterfallFloors = [
            levelWaterfallFloor(0.74),
            levelWaterfallFloor(0.74),
            [0.2, 0.2, 0.4, 0.4],
            levelWaterfallFloor(0.74),
        ];
        const { faces, vertices } = negZFloors(step, [[0, 0.54, 0]]);
        assert.equal(faces, 2, 'one wall each side of the step');
        for (const { floor, x } of vertices) {
            if (x < -1e-6) close(floor, 0.2);
            if (x > 1e-6) close(floor, 0.4);
        }
        assert.deepEqual(
            vertices
                .filter(({ x }) => Math.abs(x) < 1e-6)
                .map(({ floor }) => floor)
                .sort((left, right) => left - right),
            [0.2, 0.2, 0.4, 0.4].map((value) => Math.fround(value)),
        );
    });

    it('keeps sloping walls of neighbouring columns apart', () => {
        // Two ramps side by side: each wall slopes on its own.
        const slope: WaterfallFloors = [
            levelWaterfallFloor(0.74),
            levelWaterfallFloor(0.74),
            [0.4, 0.6, 0.6, 0.8],
            levelWaterfallFloor(0.74),
        ];
        assert.equal(
            negZFloors(slope, [
                [0, 0.54, 0],
                [1, 0.54, 0],
            ]).faces,
            2,
        );
        // Level floors still merge into one long wall.
        assert.equal(
            negZFloors(levelWaterfallFloors(0.4), [
                [0, 0.54, 0],
                [1, 0.54, 0],
            ]).faces,
            1,
        );
    });

    it('still merges stacked walls of one column', () => {
        const floors = levelWaterfallFloors(0.4);
        const lower: Vec3 = [0, 0.14, 0];
        const upper: Vec3 = [0, 0.54, 0];
        const column = [
            { fallFloors: floors, position: lower, surfaceY: 0.74 },
            { fallFloors: floors, position: upper, surfaceY: 0.74 },
        ];
        const geometry = createMergedWaterSideGeometry(column);
        // One merged quad per side.
        assert.equal(geometry.getAttribute('position').count, 16);
        geometry.dispose();
    });

    it('leaves the attribute off walls built without floors', () => {
        const geometry = createMergedWaterSideGeometry([
            { position: [0, 0.14, 0], surfaceY: 0.34 },
        ]);
        assert.equal(geometry.getAttribute('waterFallFloor'), undefined);
        geometry.dispose();
    });

    it('rebuilds a retained side chunk when a fall changes', () => {
        const position: Vec3 = [0, 0.54, 0];
        const base = {
            fallFloors: levelWaterfallFloors(0.4),
            position,
            surfaceY: 0.74,
            waterfall: { key: 'a' },
        };
        assert.equal(waterSideInstancesEqual(base, { ...base }), true);
        assert.equal(
            waterSideInstancesEqual(base, {
                ...base,
                fallFloors: [
                    levelWaterfallFloor(0.4),
                    levelWaterfallFloor(0.4),
                    levelWaterfallFloor(0.4),
                    levelWaterfallFloor(0.74),
                ],
            }),
            false,
        );
        // A ramp turned beside the wall changes the slope, not the lowest
        // floor.
        assert.equal(
            waterSideInstancesEqual(base, {
                ...base,
                fallFloors: [
                    levelWaterfallFloor(0.4),
                    levelWaterfallFloor(0.4),
                    [0.4, 0.6, 0.6, 0.8],
                    levelWaterfallFloor(0.4),
                ],
            }),
            false,
        );
        assert.equal(
            waterSideInstancesEqual(base, { ...base, waterfall: { key: 'b' } }),
            false,
        );
    });
});

describe('waterfall materials', () => {
    it('keeps plain block water free of waterfall code', () => {
        const material = createWaterBlockMaterial(settings());
        const defines = Object.keys(material.defines ?? {});
        assert.ok(!defines.some((name) => name.includes('WATER_FALL')));
        assert.equal(material.depthWrite, true);
        material.dispose();
    });

    it('turns on one waterfall part per material', () => {
        for (const [part, define] of [
            ['sides', 'USE_WATER_FALL_SIDES'],
            ['lip', 'USE_WATER_FALL_LIP'],
            ['extras', 'USE_WATER_FALL_EXTRAS'],
        ] as const) {
            const material = createWaterBlockMaterial(
                settings({ waterfall: part, waterfallSimple: true }),
            );
            assert.ok(define in (material.defines ?? {}), define);
            assert.ok('WATER_FALL_SIMPLE' in (material.defines ?? {}));
            material.dispose();
        }
    });

    it('draws the extras without depth writes, so they never cut holes', () => {
        const material = createWaterBlockMaterial(
            settings({
                waterfall: 'extras',
                waterfallSnowUniform: { value: 0 },
            }),
        );
        assert.equal(material.depthWrite, false);
        assert.equal(material.transparent, true);
        // One draw per extras mesh, not a back and a front pass.
        assert.equal(material.forceSinglePass, true);
        assert.equal(
            createWaterBlockMaterial(settings({ waterfall: 'sides' }))
                .forceSinglePass,
            false,
        );
        // A clone (the pack layout preview fades copies) keeps the part.
        const preview = material.clone();
        assert.ok('USE_WATER_FALL_EXTRAS' in (preview.defines ?? {}));
        assert.equal(preview.depthWrite, false);
        material.dispose();
        preview.dispose();
    });

    it('splices the waterfall code into the standard shader', () => {
        const shader = {
            fragmentShader: ShaderLib.standard.fragmentShader,
            uniforms: {},
            vertexShader: ShaderLib.standard.vertexShader,
        };
        injectWaterBlockShader(shader, {});
        assert.match(shader.vertexShader, /attribute float waterFallFloor;/);
        assert.match(shader.vertexShader, /attribute vec4 waterfallShape;/);
        assert.match(shader.fragmentShader, /float waterfallStreaks\(/);
        // Every waterfall block sits behind its define.
        assert.match(shader.fragmentShader, /#ifdef USE_WATER_FALL_SIDES/);
        assert.match(shader.fragmentShader, /#ifdef USE_WATER_FALL_LIP/);
        assert.match(shader.fragmentShader, /#ifdef USE_WATER_FALL_EXTRAS/);
        // The flow wraps, so the noise lattice stays small however long the
        // scene runs.
        assert.match(shader.fragmentShader, /mod\( uTime \* rate/);
    });
});
