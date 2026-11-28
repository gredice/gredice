import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene, ShaderChunk, ShaderLib, UniformsUtils } from 'three';
import {
    attachGroundMistToScene,
    clearGroundMistUniforms,
    getGroundMistUniforms,
    groundMistReplayFragment,
    groundMistRules,
    groundMistShaderFunctions,
    installGroundMistShaderChunk,
    readAppliedGroundMist,
    readGroundMistUniforms,
    resolveGroundMistBandScale,
    resolveGroundMistLevel,
    resolveGroundMistPhaseSpeed,
    resolveGroundMistRowVariation,
    sampleGroundMist,
    suspendGroundMist,
    writeGroundMistUniforms,
} from './groundMistShaderChunk';

const close = (actual: number, expected: number, tolerance = 1e-6) =>
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${actual} is not ${expected}`,
    );

test('mist bands, caps and haze follow GAME_ART "Fog and mist"', () => {
    assert.equal(groundMistRules.bandSpacing, 1.45);
    assert.equal(groundMistRules.fadeTop, 0.42);
    assert.equal(groundMistRules.groundCap, 0.45);
    assert.equal(groundMistRules.standingCap, 0.3);
    assert.equal(groundMistRules.hazeMax, 0.2);
    // Slides at about 0.2 units per second along the screen axis.
    close(
        resolveGroundMistPhaseSpeed(0) / groundMistRules.pillFrequency,
        0.19,
        0.01,
    );
    assert.ok(resolveGroundMistPhaseSpeed(3) > resolveGroundMistPhaseSpeed(0));
    assert.equal(
        resolveGroundMistPhaseSpeed(Number.NaN),
        groundMistRules.phaseSpeed,
    );
});

test('mist is densest at the ground, capped, and gone 0.42 units up', () => {
    // A full band on the ground reaches the ground cap, never more.
    close(sampleGroundMist({ amount: 1, bands: 1, height: 0 }), 0.45);
    close(sampleGroundMist({ amount: 1, bands: 1, height: -0.3 }), 0.45);
    // Between bands only a thin floor of mist.
    close(sampleGroundMist({ amount: 1, bands: 0, height: 0 }), 0.1, 0.01);
    // On anything standing it stays at or under 0.3: a bed skirt, a leg or
    // a stem from 0.035 units (about 3 px at zoom 100) above the block top,
    // so only its contact line takes the ground's cap.
    for (let height = 0.035; height <= 2; height += 0.005) {
        assert.ok(
            sampleGroundMist({ amount: 1, bands: 1, height }) <= 0.3 + 1e-9,
            `height ${height}`,
        );
    }
    for (const height of [0.04, 0.06, 0.1]) {
        assert.ok(sampleGroundMist({ amount: 1, bands: 1, height }) <= 0.3);
    }
    // The ground itself (its block top, flat to a hundredth) keeps 0.45.
    close(sampleGroundMist({ amount: 1, bands: 1, height: 0.01 }), 0.45);
    // Gone 0.42 units up; no fog, no mist.
    assert.equal(sampleGroundMist({ amount: 1, bands: 1, height: 0.42 }), 0);
    assert.equal(sampleGroundMist({ amount: 0, bands: 1, height: 0 }), 0);
});

test('rows vary, so a big garden shows no even stripes', () => {
    const rows = Array.from({ length: 400 }, (_, index) =>
        resolveGroundMistRowVariation(index - 200),
    );
    const rules = groundMistRules;
    for (const row of rows) {
        // A band is (all but) gone before its row ends, so rows never cut
        // each other, even shifted off the row's centre.
        assert.ok(row.edge > rules.bandCore && row.edge < 0.5, `${row.edge}`);
        assert.ok(Math.abs(row.shift) <= rules.rowShift + 1e-9);
        assert.ok(row.edge + Math.abs(row.shift) <= 0.52 + 1e-9);
        assert.ok(
            row.frequency >= rules.pillFrequency * 0.8 - 1e-9 &&
                row.frequency <= rules.pillFrequency * 1.2 + 1e-9,
        );
        assert.ok(row.density <= 1.15 + 1e-9);
        assert.ok(row.density >= (row.gap ? 0.85 * 0.25 : 0.85) - 1e-9);
    }
    const gaps = rows.filter((row) => row.gap).length / rows.length;
    assert.ok(gaps > 0.06 && gaps < 0.2, `gap share ${gaps}`);
    const spread = (values: number[]) =>
        Math.max(...values) - Math.min(...values);
    assert.ok(
        spread(rows.map((row) => row.frequency)) > 0.3 * rules.pillFrequency,
    );
    assert.ok(spread(rows.map((row) => row.edge)) > 0.15 * rules.bandEdge);
    // Bands sit unevenly in their rows, so rows are not evenly spaced.
    assert.ok(spread(rows.map((row) => row.shift)) > rules.rowShift);
    // Neighbouring rows differ (uncorrelated rows average a third of the
    // range apart).
    let apart = 0;
    for (let index = 1; index < rows.length; index += 1) {
        const a = rows[index - 1];
        const b = rows[index];
        if (a && b) apart += Math.abs(a.frequency - b.frequency);
    }
    const range = 0.4 * rules.pillFrequency;
    assert.ok(
        apart / (rows.length - 1) > 0.25 * range,
        `neighbours ${apart / (rows.length - 1)} apart`,
    );
    // The shader uses the same hash and ranges.
    assert.match(groundMistShaderFunctions, /float grediceMistRowHash\(/);
    assert.match(groundMistShaderFunctions, /return band \* pills \* density;/);
});

test('bands soften where a farm shows many rows at once', () => {
    const upDepth = 1 / Math.sqrt(3);
    // The default island shows about four rows: full contrast.
    assert.equal(resolveGroundMistBandScale({ upDepth, visibleHeight: 3 }), 1);
    // A farm filling a 1280 × 800 view (8 units tall) shows about ten.
    const farm = resolveGroundMistBandScale({ upDepth, visibleHeight: 8 });
    assert.ok(farm < 0.6 && farm >= groundMistRules.minBandScale, `${farm}`);
    // Off-screen or degenerate input keeps full contrast.
    assert.equal(
        resolveGroundMistBandScale({ upDepth: 0, visibleHeight: 8 }),
        1,
    );
    assert.equal(resolveGroundMistBandScale({ upDepth, visibleHeight: -1 }), 1);
    assert.match(groundMistShaderFunctions, /grediceMistCenter\.w/);
});

test('back haze rises from the view centre to at most 0.2 at the top', () => {
    const haze = groundMistRules.hazeMax;
    for (const screenUp of [-1, -0.5, 0]) {
        assert.equal(
            sampleGroundMist({
                amount: 0,
                bands: 0,
                haze,
                height: 5,
                screenUp,
            }),
            0,
        );
    }
    const top = sampleGroundMist({
        amount: 0,
        bands: 0,
        haze,
        height: 5,
        screenUp: 1,
    });
    close(top, 0.2);
    const middle = sampleGroundMist({
        amount: 0,
        bands: 0,
        haze,
        height: 5,
        screenUp: 0.5,
    });
    assert.ok(middle > 0 && middle < top);
});

test('the chunk reaches every lit built-in material once, with shared uniforms', () => {
    installGroundMistShaderChunk();
    const fogPars = ShaderChunk.fog_pars_fragment;
    const fog = ShaderChunk.fog_fragment;
    installGroundMistShaderChunk();
    assert.equal(ShaderChunk.fog_pars_fragment, fogPars, 'installs once');
    assert.equal(ShaderChunk.fog_fragment, fog, 'installs once');
    assert.match(
        fogPars,
        /defined\( STANDARD \) \|\| defined\( LAMBERT \) \|\| defined\( PHONG \) \|\| defined\( TOON \)/,
    );
    assert.match(fog, /#ifdef GREDICE_GROUND_MIST/);
    assert.match(fog, /grediceMixGroundMist\(/);

    const shared = getGroundMistUniforms();
    for (const key of ['physical', 'standard', 'lambert', 'phong', 'toon']) {
        const uniforms: unknown = Reflect.get(
            Reflect.get(ShaderLib, key),
            'uniforms',
        );
        assert.ok(typeof uniforms === 'object' && uniforms !== null, key);
        // A material's uniforms are a clone of the library's; the typed
        // arrays must survive the clone by reference, so one write reaches
        // every compiled program.
        const cloned = UniformsUtils.clone(
            Object.fromEntries(Object.entries(uniforms)),
        );
        for (const [name, uniform] of Object.entries(shared)) {
            assert.equal(cloned[name]?.value, uniform.value, `${key} ${name}`);
        }
    }
});

test('the replay applies the same mist to the cached on-screen colour', () => {
    assert.match(groundMistReplayFragment, /grediceGroundMist\(mistWorld\)/);
    assert.match(groundMistReplayFragment, /grediceMixGroundMist\(/);
    assert.match(groundMistShaderFunctions, /uniform vec4 grediceMistParams;/);
    // GLSL leaves smoothstep undefined for reversed edges; keep them ordered.
    for (const match of groundMistShaderFunctions.matchAll(
        /smoothstep\(\s*(-?\d+\.\d+),\s*(-?\d+\.\d+),/g,
    )) {
        assert.ok(Number(match[1]) < Number(match[2]), match[0]);
    }
});

test('mist shows only while the garden scene renders, and never in a cache capture', () => {
    const write = (amount: number) =>
        writeGroundMistUniforms({
            amount,
            phase: 1.3,
            groundY: 0.4,
            haze: amount * 0.2,
            color: [0.89, 0.87, 0.99],
            alongX: -1,
            alongZ: 1,
            up: [0.41, 0.82, 0.41],
            halfHeight: 4,
            center: [-100, 100, -100],
        });
    const scene = new Scene();
    const calls: string[] = [];
    scene.onBeforeRender = () => calls.push('before');
    scene.onAfterRender = () => calls.push('after');
    const detach = attachGroundMistToScene(scene);
    const render = (during: () => void) => {
        Reflect.apply(scene.onBeforeRender, scene, []);
        during();
        Reflect.apply(scene.onAfterRender, scene, []);
    };

    assert.equal(write(1), true);
    assert.equal(write(1), false, 'no change, no render request');
    // Outside the garden's render (another canvas) the shaders see none.
    assert.deepEqual(readAppliedGroundMist(), { amount: 0, haze: 0 });
    render(() => {
        close(readAppliedGroundMist().amount, 1);
        close(readAppliedGroundMist().haze, 0.2);
    });
    assert.deepEqual(readAppliedGroundMist(), { amount: 0, haze: 0 });
    assert.deepEqual(calls, ['before', 'after'], 'existing hooks still run');

    // The static cache captures the same scene with the mist suspended.
    const resume = suspendGroundMist();
    render(() => assert.equal(readAppliedGroundMist().amount, 0));
    resume();
    render(() => close(readAppliedGroundMist().amount, 1));

    assert.equal(clearGroundMistUniforms(), true);
    render(() => assert.equal(readAppliedGroundMist().amount, 0));
    close(readGroundMistUniforms().groundY, 0.4);
    detach();
    assert.equal(typeof scene.onBeforeRender, 'function');
    Reflect.apply(scene.onBeforeRender, scene, []);
    assert.equal(calls.at(-1), 'before', 'detach restores the hooks');
});

test('mist is measured from the most common terrain top, not world zero', () => {
    const heights: Record<string, number> = {
        Block_Grass: 0.4,
        Block_Ground: 0.4,
        Block_Water: 0.3,
        Raised_Bed: 0.6,
    };
    const lookup = (name: string) => heights[name];
    const stack = (x: number, ...names: string[]) => ({
        position: { x, y: 0, z: 0 },
        blocks: names.map((name, index) => ({
            id: `${x}:${index}`,
            name,
            rotation: 0,
        })),
    });
    assert.equal(resolveGroundMistLevel([], lookup), 0);
    assert.equal(resolveGroundMistLevel(undefined, lookup), 0);
    const level = resolveGroundMistLevel(
        [
            stack(0, 'Block_Grass'),
            stack(1, 'Block_Grass', 'Raised_Bed'),
            stack(2, 'Block_Ground'),
            stack(3, 'Block_Grass', 'Block_Grass'),
            stack(4, 'Block_Water'),
            stack(5, 'Block_Water'),
            stack(6, 'Block_Water'),
            stack(7, 'Block_Water'),
        ],
        lookup,
    );
    close(level, 0.4);
});
