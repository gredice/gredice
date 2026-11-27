import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import {
    createRainPuddleMesh,
    createRainPuddleUniforms,
} from './rainPuddleMesh';
import {
    createRainPuddleSites,
    rainPuddleRules,
    resolveRainGroundWetness,
    resolveRainPuddleAmount,
    resolveRainPuddleGrowth,
    resolveRainPuddleRipples,
} from './rainPuddleState';
import { rainTerrainTopOffset } from './rainRippleState';

function stack(x: number, z: number, ...names: string[]) {
    return {
        position: new Vector3(x, 0, z),
        blocks: names.map((name, index) => ({
            id: `${x}:${z}:${index}`,
            name,
            rotation: 0,
        })),
    };
}

/** A path `length` tiles long and `width` wide, in grass. */
function pathGarden(length: number, width: number) {
    const stacks = [];
    for (let x = -1; x <= length; x += 1) {
        for (let z = -1; z <= width; z += 1) {
            const onPath = x >= 0 && x < length && z >= 0 && z < width;
            stacks.push(stack(x, z, onPath ? 'Block_Ground' : 'Block_Grass'));
        }
    }
    return stacks;
}

const blockData = getLocalSandboxBlockData();

test('puddles lie on path and bare soil only, never on grass, beds or props', () => {
    const sites = createRainPuddleSites({
        blockData,
        cap: 24,
        gardenId: 1,
        stacks: [
            stack(0, 0, 'Block_Grass'),
            stack(2, 0, 'Block_Grass', 'Raised_Bed'),
            stack(4, 0, 'Block_Snow'),
            stack(6, 0, 'Block_Ground', 'Stool'),
            stack(8, 0, 'Block_Sand'),
        ],
    });
    assert.equal(sites.length, 1);
    assert.equal(Math.round(sites[0]?.x ?? 0), 8);
    assert.equal(sites[0]?.y, rainTerrainTopOffset + rainPuddleRules.lift);
});

test('about one puddle per four path tiles, up to the tier cap', () => {
    const path = pathGarden(8, 2);
    assert.equal(
        createRainPuddleSites({ blockData, cap: 24, gardenId: 1, stacks: path })
            .length,
        4,
    );
    assert.equal(
        createRainPuddleSites({ blockData, cap: 3, gardenId: 1, stacks: path })
            .length,
        3,
    );
    assert.equal(
        createRainPuddleSites({ blockData, cap: 0, gardenId: 1, stacks: path })
            .length,
        0,
    );
    assert.equal(
        createRainPuddleSites({
            blockData,
            cap: 24,
            gardenId: 1,
            stacks: pathGarden(1, 1),
        }).length,
        1,
    );
});

test('puddles are stable, spread out and stay on their tile', () => {
    const path = pathGarden(12, 3);
    const high = createRainPuddleSites({
        blockData,
        cap: 24,
        gardenId: 7,
        stacks: path,
    });
    const again = createRainPuddleSites({
        blockData,
        cap: 24,
        gardenId: 7,
        stacks: [...path].reverse(),
    });
    assert.deepEqual(again, high);
    const low = createRainPuddleSites({
        blockData,
        cap: 6,
        gardenId: 7,
        stacks: path,
    });
    // A lower tier's puddles are the first of a higher tier's.
    assert.deepEqual(low, high.slice(0, 6));
    for (const site of high) {
        const reach =
            Math.max(site.halfLength, site.halfWidth) *
            (1 + rainPuddleRules.outlineWobble);
        const tileX = Math.round(site.x);
        const tileZ = Math.round(site.z);
        assert.ok(Math.abs(site.x - tileX) + reach <= 0.5, site.id);
        assert.ok(Math.abs(site.z - tileZ) + reach <= 0.5, site.id);
        // 0.2 to 0.6 units long, 0.6 to 0.76 as wide.
        assert.ok(site.halfLength >= 0.1 && site.halfLength <= 0.3);
        const aspect = site.halfWidth / site.halfLength;
        assert.ok(aspect >= 0.6 - 1e-9 && aspect <= 0.76 + 1e-9);
    }
    const tiles = new Set(
        high.map((site) => `${Math.round(site.x)}:${Math.round(site.z)}`),
    );
    assert.equal(tiles.size, high.length);
});

test('beside a prop a puddle moves away from it, never toward a side neighbour that stands', () => {
    // The default island: a path tile with a raised bed on one side and a
    // tree and a bird house on the far diagonals. The diagonals must not
    // push the puddle toward the bed, where it hides behind it.
    const sites = createRainPuddleSites({
        blockData,
        cap: 24,
        gardenId: 1,
        stacks: [
            stack(0, 1, 'Block_Ground'),
            stack(0, 0, 'Block_Grass', 'Raised_Bed'),
            stack(-1, 2, 'Block_Grass', 'Stool'),
            stack(1, 2, 'Block_Grass', 'Stool'),
            stack(0, 2, 'Block_Grass'),
            stack(-1, 1, 'Block_Grass'),
            stack(1, 1, 'Block_Grass'),
        ],
    });
    assert.equal(sites.length, 1);
    const [site] = sites;
    assert.ok(site);
    assert.ok(site.z > 1.05, `moved away from the bed (z ${site.z})`);
    assert.ok(Math.abs(site.x) < 1e-9);
    // Toward the grass it keeps clear of the grass bank too.
    const reach =
        site.halfLength * (1 + rainPuddleRules.outlineWobble) +
        rainPuddleRules.edgeMargin +
        rainPuddleRules.bankMargin;
    assert.ok(site.z - 1 + reach <= 0.5 + 1e-9);

    // Boxed in between two props: centred and small.
    const boxed = createRainPuddleSites({
        blockData,
        cap: 24,
        gardenId: 1,
        stacks: [
            stack(0, 1, 'Block_Ground'),
            stack(0, 0, 'Block_Grass', 'Raised_Bed'),
            stack(0, 2, 'Block_Grass', 'Stool'),
        ],
    })[0];
    assert.ok(boxed);
    assert.equal(boxed.x, 0);
    assert.equal(boxed.z, 1);
    assert.ok(boxed.halfLength <= rainPuddleRules.boxedInMaxHalfLength);
});

test('puddles appear with wetness, grow from 55% and fade under snow', () => {
    assert.equal(resolveRainGroundWetness(0), 0);
    assert.ok(resolveRainGroundWetness(0.6) > 0.8);
    assert.equal(resolveRainGroundWetness(1), 1);
    assert.equal(resolveRainPuddleAmount(0.25, 0), 0);
    assert.equal(resolveRainPuddleAmount(0.85, 0), 1);
    assert.equal(resolveRainPuddleAmount(1, 1), 0);
    assert.equal(resolveRainPuddleAmount(1, 0.5), 0.5);
    assert.equal(resolveRainPuddleGrowth(0), 0.55);
    assert.equal(resolveRainPuddleGrowth(1), 1);
    assert.equal(resolveRainPuddleRipples(0), 0);
    assert.equal(resolveRainPuddleRipples(1), 1);
    // The outline wobble stays within 10%.
    assert.ok(
        rainPuddleRules.outlineSecond + rainPuddleRules.outlineThird <=
            rainPuddleRules.outlineWobble + 1e-9,
    );
});

test('every puddle shares one instanced draw', () => {
    const sites = createRainPuddleSites({
        blockData,
        cap: 24,
        gardenId: 1,
        stacks: pathGarden(8, 2),
    });
    const time = { value: 0 };
    const wetness = { value: 1 };
    const mesh = createRainPuddleMesh({
        sites,
        time,
        uniforms: createRainPuddleUniforms(),
        wetness,
    });
    assert.equal(mesh.geometry.instanceCount, sites.length);
    assert.equal(mesh.material.uniforms.uTime, time);
    assert.equal(mesh.material.uniforms.uWetness, wetness);
    assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.material.depthTest, true);
    // No per-pixel noise: the hash only picks ripple centres per cycle.
    assert.doesNotMatch(mesh.material.fragmentShader, /fract\(sin\(dot/);
    assert.match(
        mesh.material.fragmentShader,
        /#include <colorspace_fragment>/,
    );
    mesh.geometry.dispose();
    mesh.material.dispose();
});
