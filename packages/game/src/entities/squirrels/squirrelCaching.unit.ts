import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { AnimationMixer, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getSeasonState } from '../../scene/seasonState';
import {
    createSquirrelCachePlan,
    sampleSquirrelCache,
    squirrelCachingEnabled,
} from './squirrelCaching';
import type { SquirrelHabitat } from './squirrelHabitat';
import { createSquirrelNut } from './squirrelNut';

const habitat: SquirrelHabitat = {
    id: 'test-tree',
    seed: 27,
    revisionKey: '1',
    treeBlockName: 'Tree',
    treePosition: new Vector3(-1, 0.4, 0),
    spawnTarget: { id: 'spawn', position: new Vector3(0, 0.4, 0) },
    escapeTargets: [],
    roamTargets: [{ id: 'cache', position: new Vector3(2, 0.4, 1) }],
    blockedCells: [{ x: 1, z: 0 }],
    groundSurfaces: Array.from({ length: 25 }, (_, index) => ({
        kind: 'ground',
        x: (index % 5) - 1,
        z: Math.floor(index / 5) - 1,
        y: 0.4,
    })),
};

describe('seasonal squirrel caching', () => {
    it('uses seeded bounded safe routes and samples frozen time without history', () => {
        const plan = createSquirrelCachePlan(habitat, 0);
        assert.ok(plan);
        assert.deepEqual(createSquirrelCachePlan(habitat, 0), plan);
        assert.ok(plan.duration < 14);
        assert.ok(plan.distance <= 6);
        assert.ok(
            plan.path.every(
                (point) =>
                    Math.round(point.x) !== 1 || Math.round(point.z) !== 0,
            ),
        );
        const carry = plan.forageSeconds + plan.carrySeconds / 2;
        const first = sampleSquirrelCache(plan, carry);
        assert.equal(first.phase, 'carry');
        assert.equal(first.nutScale, 1);
        sampleSquirrelCache(plan, 500);
        assert.deepEqual(sampleSquirrelCache(plan, carry), first);
        assert.equal(sampleSquirrelCache(plan, 0).nutScale, 0);
        const cache = sampleSquirrelCache(
            plan,
            plan.forageSeconds + plan.carrySeconds + 1.2,
        );
        assert.equal(cache.phase, 'cache');
        assert.ok(cache.nutScale > 0 && cache.nutScale < 1);
        assert.deepEqual(cache.position, habitat.roamTargets[0].position);
        assert.equal(
            sampleSquirrelCache(plan, plan.duration - 0.1).phase,
            'pause',
        );
        assert.equal(sampleSquirrelCache(plan, plan.duration).complete, true);
        assert.equal(sampleSquirrelCache(plan, 500).nutScale, 0);
    });
    it('gives up when every cache target is unreachable, without changing the habitat', () => {
        const blocked = {
            ...habitat,
            blockedCells: [-1, 0, 1, 2, 3].map((z) => ({ x: 1, z })),
        };
        const before = JSON.stringify(blocked);
        assert.equal(createSquirrelCachePlan(blocked, 0), null);
        assert.equal(JSON.stringify(blocked), before);
        assert.equal(
            createSquirrelCachePlan({ ...habitat, roamTargets: [] }, 0),
            null,
        );
    });
    it('uses the shared calendar and suppresses severe weather and reduced motion', () => {
        const conditions = {
            season: getSeasonState(new Date(2024, 9, 22)).season,
            enabled: true,
            reducedMotion: false,
            rain: 0,
            snow: 0,
        };
        assert.equal(squirrelCachingEnabled(conditions), true);
        for (const change of [
            { rain: 0.7 },
            { snow: 0.01 },
            { reducedMotion: true },
            { enabled: false },
            { season: getSeasonState(new Date(2024, 5, 22)).season },
            { season: getSeasonState(new Date(2024, 11, 22)).season },
        ]) {
            assert.equal(
                squirrelCachingEnabled({ ...conditions, ...change }),
                false,
            );
        }
        assert.equal(
            squirrelCachingEnabled({ ...conditions, rain: 0.4 }),
            true,
        );
    });
    it('keeps one non-interactive nut on the exported animated head and disposes it', async () => {
        const bytes = await readFile(
            new URL(
                '../../../../../apps/garden/public/assets/models/Squirrel.glb',
                import.meta.url,
            ),
        );
        const gltf = await new GLTFLoader().parseAsync(
            bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
            ),
            '',
        );
        const clone = gltf.scene.clone(true);
        const nut = createSquirrelNut(clone);
        assert.ok(nut);
        assert.equal(
            gltf.scene.getObjectByName('Squirrel:DecorativeNut'),
            undefined,
        );
        assert.equal(nut.mesh.parent?.name, 'Squirrel_HeadPivot');
        assert.equal(nut.mesh.geometry.getAttribute('position').count / 3, 20);
        assert.equal(nut.mesh.castShadow, false);
        const parent = nut.mesh.parent;
        assert.ok(parent);
        const local = nut.mesh.position.clone();
        const mixer = new AnimationMixer(clone);
        const actor = new Group();
        actor.scale.setScalar(0.2);
        actor.add(clone);
        for (const clip of gltf.animations) {
            mixer.stopAllAction();
            mixer.clipAction(clip).play();
            for (const time of [0, 0.2, 0.7, 1.2]) {
                mixer.setTime(time);
                actor.position.set(time, 0.4, -time);
                actor.rotation.y = time * 2;
                actor.updateMatrixWorld(true);
                const actual = nut.mesh.getWorldPosition(new Vector3());
                const expected = local.clone().applyMatrix4(parent.matrixWorld);
                assert.ok(
                    actual.distanceTo(expected) < 1e-8,
                    `${clip.name}: ${time}`,
                );
            }
        }
        let geometryDisposed = false;
        let materialDisposed = false;
        nut.mesh.geometry.addEventListener('dispose', () => {
            geometryDisposed = true;
        });
        nut.mesh.material.addEventListener('dispose', () => {
            materialDisposed = true;
        });
        nut.dispose();
        assert.equal(
            clone.getObjectByName('Squirrel:DecorativeNut'),
            undefined,
        );
        assert.equal(geometryDisposed, true);
        assert.equal(materialDisposed, true);
        mixer.stopAllAction();
        mixer.uncacheRoot(clone);
    });
});
