import assert from 'node:assert/strict';
import test from 'node:test';
import { Matrix4, Raycaster, Vector3 } from 'three';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { getWaterBlockDepthAtLocalPosition } from '../entities/waterBlockDepth';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { getStackHeight } from '../utils/stackHeightCore';
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
        blockData: getLocalSandboxBlockData(),
        gardenId: 7,
        tier: 'high',
        coveredCells: new Set(),
    });
}

test('only flat, exposed, stationary wet-overlay surfaces receive ripples', () => {
    for (const name of [
        'Block_Sand_Angle',
        'Block_Grass_Angle',
        'Block_Ground_Corner',
        'Block_Polished_Stone_Stairs',
        'Block_Gravel',
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
        blockData: getLocalSandboxBlockData(),
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
            blockData: getLocalSandboxBlockData(),
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
    const rain = { value: 1 };
    const wetness = { value: 1 };
    const puddleStrength = { value: 1 };
    const mesh = createRainRippleMesh({
        anchors: anchors(),
        time,
        rain,
        wetness,
        puddleStrength,
    });
    assert.equal(mesh.material.uniforms.uTime, time);
    assert.equal(mesh.material.uniforms.uRain, rain);
    assert.equal(mesh.renderOrder, 2);
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

test('all supported flat surfaces use their rendered top and material strength', () => {
    for (const name of [
        'Block_Grass',
        'Block_Ground',
        'Block_Dry_Ground',
        'Block_Polished_Stone',
        'Block_Sand',
        'Block_Swamp_Ground',
        'Block_Water',
        'Block_Swamp_Water',
    ]) {
        const site = instance('top', name);
        const result = anchors([site]);
        assert.equal(result.length, 1, name);
        const water = name.endsWith('_Water');
        assert.equal(result[0].water, water);
        assert(
            Math.abs(result[0].position[1] - (water ? 0.344 : 0.404)) < 1e-6,
            name,
        );
    }
    assert(
        anchors([instance('grass', 'Block_Grass')])[0].opacity <
            anchors([instance('water', 'Block_Water')])[0].opacity,
    );
    assert(
        anchors([instance('swamp', 'Block_Swamp_Water')])[0].opacity <
            anchors([instance('water', 'Block_Water')])[0].opacity,
    );
});

test('water uses stack and shore heights and keeps the whole ring below rotated banks', () => {
    const blockData = getLocalSandboxBlockData();
    for (const name of ['Block_Water', 'Block_Swamp_Water']) {
        for (const support of [
            'Block_Sand',
            'Block_Ground_Angle',
            'Block_Grass_Corner',
            'Block_Sand_Reverse_Corner',
        ]) {
            for (let rotation = 0; rotation < 4; rotation++) {
                const site = instance('water', name);
                site.stack.blocks.unshift({
                    id: 'support',
                    name: support,
                    rotation,
                });
                site.blockIndex = 1;
                site.stackHeight = getStackHeight(
                    blockData,
                    site.stack,
                    site.block,
                );
                const result = anchors([site]);
                assert.equal(
                    result.length,
                    1,
                    `${name} on ${support} rotation ${rotation}`,
                );
                const ring = result[0];
                assert(
                    Math.abs(
                        ring.position[1] -
                            (support === 'Block_Sand' ? 0.744 : 0.344),
                    ) < 1e-6,
                );
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
                    const depth = getWaterBlockDepthAtLocalPosition({
                        block: site.block,
                        stack: site.stack,
                        blockData,
                        localX: ring.position[0] + Math.cos(a) * ring.radius,
                        localZ: ring.position[2] + Math.sin(a) * ring.radius,
                    });
                    assert(depth > 0.15, `${support} bank intersects ring`);
                }
            }
        }
    }
    const site = instance('upper', 'Block_Water');
    site.stack.blocks.unshift({
        id: 'lower',
        name: 'Block_Water',
        rotation: 0,
    });
    site.blockIndex = 1;
    assert(Math.abs(anchors([site])[0].position[1] - 0.744) < 1e-6);
});

test('mixed surfaces share stable quality caps and cover rules', () => {
    const blockData = getLocalSandboxBlockData();
    const names = [
        'Block_Grass',
        'Block_Ground',
        'Block_Water',
        'Block_Swamp_Water',
    ];
    const sites = Array.from({ length: 200 }, (_, i) =>
        instance(`mixed:${i}`, names[i % names.length], i),
    );
    const high = anchors(sites);
    assert.equal(high.length, 48);
    assert(high.some((site) => site.water));
    assert(high.some((site) => !site.water));
    assert.deepEqual(anchors(sites.toReversed()), high);
    assert.deepEqual(
        createRainRippleAnchors({
            instances: sites,
            blockData,
            coveredCells: new Set(),
            gardenId: 7,
            tier: 'medium',
        }),
        high.slice(0, 24),
    );
    for (const site of sites) {
        site.stack.blocks.push({
            id: `cover:${site.id}`,
            name: 'Shade',
            rotation: 0,
        });
    }
    assert.deepEqual(anchors(sites), []);
    const raised = instance('raised', 'Block_Ground');
    raised.stackHeight = 2;
    assert.equal(anchors([raised])[0].position[1], 2.404);
});
