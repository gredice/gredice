import assert from 'node:assert/strict';
import test from 'node:test';
import { Matrix4, Raycaster, Vector3 } from 'three';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { createRainRippleMesh } from './rainRippleMesh';
import {
    createRainRippleAnchors,
    getRainCoveredCells,
    rainRippleCaps,
    rainRipplesEnabled,
} from './rainRippleState';

function instance(id: string, name = 'Block_Sand', x = 0): EntityBlockInstance {
    const block = { id, name, rotation: 0 };
    return {
        block,
        blockIndex: 0,
        id,
        pickupOutlineVisible: false,
        position: [x, 0.2, 0],
        rotation: 0,
        stackHeight: 0,
        stack: { position: new Vector3(x, 0, 0), blocks: [block] },
    };
}

function anchors(instances = [instance('sand')]) {
    return createRainRippleAnchors({
        instances,
        gardenId: 7,
        tier: 'high',
        coveredCells: new Set(),
    });
}

test('only flat, exposed, stationary wet-overlay surfaces receive ripples', () => {
    for (const name of [
        'Block_Sand_Angle',
        'Block_Grass',
        'Block_Water',
        'Block_Snow',
        'Fence',
        'Stool',
    ]) {
        assert.equal(anchors([instance('excluded', name)]).length, 0, name);
    }
    for (const name of [
        'Raised_Bed',
        'BeachUmbrella',
        'Tree',
        'Block_Sand',
        'MulchWood',
    ]) {
        const covered = instance('covered');
        covered.stack.blocks.push({ id: 'cover', name, rotation: 0 });
        assert.equal(anchors([covered]).length, 0, name);
    }
    assert.equal(
        anchors([{ ...instance('dragged'), pickupOutlineVisible: true }])
            .length,
        0,
    );
    assert.equal(anchors([instance('swamp', 'Block_Swamp_Ground')]).length, 1);
});

test('cover footprints and adjacent canopy overhangs suppress ground sites', () => {
    const cover = instance('tree', 'Tree');
    const coveredCells = getRainCoveredCells(
        [cover.stack],
        getLocalSandboxBlockData(),
    );
    assert(coveredCells.has('2:0'));
    const sites = [
        instance('near', 'Block_Sand', 2),
        instance('open', 'Block_Sand', 6),
    ];
    const result = createRainRippleAnchors({
        instances: sites,
        coveredCells,
        gardenId: 7,
        tier: 'high',
    });
    assert.equal(result.length, 1);
    assert(result[0].id.includes('open'));
    const table = instance('table', 'OutletDisplayTable');
    const cells = getRainCoveredCells(
        [table.stack],
        getLocalSandboxBlockData(),
    );
    assert(cells.has('1:0'));
});

test('stable bounded seeds survive reordered stacks and quality changes', () => {
    const sites = Array.from({ length: 200 }, (_, i) =>
        instance(`sand:${i}`, 'Block_Sand', i),
    );
    const high = anchors(sites);
    assert.deepEqual(anchors(sites.toReversed()), high);
    for (const tier of [
        'low',
        'auto-constrained',
        'medium',
        'high',
        'custom',
    ] as const) {
        const result = createRainRippleAnchors({
            instances: sites,
            coveredCells: new Set(),
            gardenId: 7,
            tier,
        });
        assert.equal(result.length, rainRippleCaps[tier]);
        assert.deepEqual(result, high.slice(0, result.length));
        for (const site of result) {
            assert(site.radius <= 0.11);
            assert(site.phase >= 0 && site.phase < 1);
            assert(site.period >= 1.1 && site.period <= 1.9);
            assert.equal(site.position[1], 0.404);
        }
    }
});

test('quality, reduced motion, weather disablement and snow gate the effect', () => {
    const defaults = {
        enabled: true,
        reducedMotion: false,
        snow: 0,
        tier: 'high',
    } as const;
    assert(rainRipplesEnabled(defaults));
    for (const option of [
        { enabled: false },
        { reducedMotion: true },
        { snow: 0.01 },
        { snow: NaN },
        { tier: 'low' },
        { tier: 'auto-constrained' },
    ] as const) {
        assert.equal(rainRipplesEnabled({ ...defaults, ...option }), false);
    }
});

test('one depth-tested instanced batch shares scene/weather uniforms and never intercepts input', () => {
    const time = { value: 12 };
    const wetness = { value: 1 };
    const puddleStrength = { value: 1 };
    const mesh = createRainRippleMesh({
        anchors: anchors(),
        time,
        wetness,
        puddleStrength,
    });
    assert.equal(mesh.material.uniforms.uTime, time);
    assert.equal(mesh.material.uniforms.uWetness, wetness);
    assert.equal(mesh.material.uniforms.uPuddleStrength, puddleStrength);
    assert.equal(mesh.material.depthTest, true);
    assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.geometry.index?.count, 6);
    const matrix = new Matrix4();
    mesh.getMatrixAt(0, matrix);
    assert(
        Math.abs(new Vector3().setFromMatrixPosition(matrix).y - 0.404) < 1e-6,
    );
    assert.deepEqual(
        new Raycaster(
            new Vector3(0, 5, 0),
            new Vector3(0, -1, 0),
        ).intersectObject(mesh),
        [],
    );
    mesh.geometry.dispose();
    mesh.material.dispose();
    mesh.dispose();
});
