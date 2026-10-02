import assert from 'node:assert/strict';
import test from 'node:test';
import { Raycaster, Vector3 } from 'three';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { getWaterBlockVerticalRange } from '../entities/waterBlockHeight';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { getRainCoveredCells } from '../rain/rainRippleState';
import { createMorningMistMesh } from './morningMistMesh';
import {
    createMorningMistAnchors,
    type morningMistCaps,
    resolveMorningMistDensity,
} from './morningMistState';

const blockData = getLocalSandboxBlockData();
function instance(
    id: string,
    name = 'Block_Grass',
    x = 0,
): EntityBlockInstance {
    const block = { id, name, rotation: 0 };
    return {
        block,
        blockIndex: 0,
        id,
        pickupOutlineVisible: false,
        position: [x, 0, 0],
        rotation: 0,
        stackHeight: 0,
        stack: { position: new Vector3(x, 0, 0), blocks: [block] },
    };
}
function anchors(
    instances = [instance('grass')],
    tier: keyof typeof morningMistCaps = 'high',
) {
    return createMorningMistAnchors({
        instances,
        gardenId: 7,
        tier,
        blockData,
        coveredCells: new Set(),
    });
}

test('morning mist requires actual fog and morning solar time, in every season', () => {
    assert.equal(resolveMorningMistDensity(0.27, { foggy: 1 }), 1);
    assert.equal(resolveMorningMistDensity(0.27, undefined), 0);
    assert.equal(resolveMorningMistDensity(0.27, { cloudy: 1, rainy: 0.2 }), 0);
    for (const time of [0, 0.14, 0.48, 0.6, 0.85, 1])
        assert.equal(resolveMorningMistDensity(time, { foggy: 1 }), 0);
    for (const weather of [
        { foggy: 0.01 },
        { foggy: 1, rainy: 1 },
        { foggy: 1, snowy: 0.1 },
        { foggy: 1, windSpeed: 2 },
    ])
        assert.equal(resolveMorningMistDensity(0.27, weather), 0);
    assert.equal(resolveMorningMistDensity(0.27, { foggy: 1 }, 0.1), 0);
    assert.equal(resolveMorningMistDensity(Number.NaN, { foggy: 1 }), 0);
    assert.equal(resolveMorningMistDensity(0.27, { foggy: Number.NaN }), 0);
    assert(resolveMorningMistDensity(0.2, { foggy: 1 }) > 0);
    assert(resolveMorningMistDensity(0.4, { foggy: 1 }) < 1);
    for (let fog = 0.05; fog < 0.8; fog += 0.001) {
        const before = resolveMorningMistDensity(0.27, { foggy: fog });
        const after = resolveMorningMistDensity(0.27, { foggy: fog + 0.001 });
        assert(after >= before && after - before < 0.003);
    }
});

test('paths, slopes, occupied tiles, props and pickup targets stay clear', () => {
    for (const name of [
        'Block_Sand',
        'Block_Grass_Angle',
        'Block_Swamp_Ground_Angle',
        'Block_Snow',
        'Raised_Bed',
        'Stool',
    ])
        assert.equal(anchors([instance('excluded', name)]).length, 0, name);
    const covered = instance('covered');
    covered.stack.blocks.push({ id: 'bed', name: 'Raised_Bed', rotation: 0 });
    assert.equal(anchors([covered]).length, 0);
    assert.equal(
        anchors([{ ...instance('picked'), pickupOutlineVisible: true }]).length,
        0,
    );
    const bed = instance('bed', 'Raised_Bed');
    assert.equal(
        createMorningMistAnchors({
            instances: [instance('near', 'Block_Grass', 1)],
            gardenId: 7,
            tier: 'high',
            blockData,
            coveredCells: getRainCoveredCells([bed.stack], blockData),
        }).length,
        0,
    );
});

test('caps and seeded placement are stable across order, quality and remounts', () => {
    const sites = Array.from({ length: 200 }, (_, i) =>
        instance(`site:${i}`, 'Block_Grass', i),
    );
    const high = anchors(sites);
    assert.deepEqual(high, anchors([...sites].reverse()));
    assert.deepEqual(anchors(sites, 'medium'), high.slice(0, 16));
    assert.equal(anchors(sites, 'custom').length, 24);
    for (const tier of ['low', 'auto-constrained'] as const)
        assert.equal(anchors(sites, tier).length, 0);
    assert.equal(high.length, 32);
    for (const anchor of high) {
        assert(anchor.radius <= 0.44);
        assert.equal(anchor.position[1], 0.49);
    }
});

test('water and stacked ground anchors follow actual top heights', () => {
    for (const name of ['Block_Water', 'Block_Swamp_Water']) {
        const water = instance('water', name);
        assert(Math.abs(anchors([water])[0].position[1] - 0.43) < 1e-9);
        water.stack.blocks.unshift({
            id: 'support',
            name: 'Block_Grass_Angle',
            rotation: 1,
        });
        water.blockIndex = 1;
        const range = getWaterBlockVerticalRange({
            block: water.block,
            stack: water.stack,
            blockData,
        });
        assert(range);
        assert.equal(anchors([water])[0].position[1], range.max + 0.09);
    }
    const raised = instance('raised');
    raised.stackHeight = 1.2;
    assert(Math.abs(anchors([raised])[0].position[1] - 1.69) < 1e-9);
});

test('mist is a single depth-tested bounded batch with no picking or shadows', () => {
    const time = { value: 12 };
    const mesh = createMorningMistMesh(anchors(), time);
    assert.equal(mesh.material.uniforms.uTime, time);
    assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.material.depthTest, true);
    assert.equal(mesh.material.forceSinglePass, true);
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.receiveShadow, false);
    assert.equal(mesh.geometry.index?.count, 6);
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
