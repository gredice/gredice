import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chestnutRoastingCartEffectAnchors } from '@gredice/js/chestnutRoastingCart';
import { Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
    createSteamParticle,
    sampleSteamParticle,
    steamParticlesPerEmitter,
} from './steamMotion';

test('authored pan anchor clears the actual unchanged roaster and bounds every full puff', async () => {
    const anchor = chestnutRoastingCartEffectAnchors.find(
        (candidate) => candidate.id === 'steam',
    );
    assert.ok(anchor);
    const bytes = readFileSync(
        new URL(
            '../../../../apps/garden/public/assets/models/ChestnutRoastingCart.glb',
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
    gltf.scene.updateMatrixWorld(true);
    const roaster = gltf.scene.getObjectByName('ChestnutRoastingCart_Roaster');
    assert.ok(roaster instanceof Mesh);
    const position = roaster.geometry.getAttribute('position');
    const nearbyHeights = [];
    for (let index = 0; index < position.count; index++) {
        const vertex = new Vector3()
            .fromBufferAttribute(position, index)
            .applyMatrix4(roaster.matrixWorld);
        if (
            Math.hypot(
                vertex.x - anchor.position[0],
                vertex.z - anchor.position[2],
            ) <= anchor.radius
        )
            nearbyHeights.push(vertex.y);
    }
    assert.ok(nearbyHeights.length > 0);
    const panTop = Math.max(...nearbyHeights);
    assert.ok(
        anchor.position[1] > panTop && anchor.position[1] - panTop < 0.04,
    );
    for (let index = 0; index < steamParticlesPerEmitter; index++) {
        const particle = createSteamParticle(
            'ChestnutRoastingCart:steam:cart',
            index,
        );
        for (let tick = 0; tick <= 320; tick++) {
            for (const windSpeed of [0, 1, 3, 100]) {
                const sample = sampleSteamParticle(
                    particle,
                    tick / 10,
                    anchor.radius,
                    windSpeed,
                    tick * 17,
                );
                assert.ok(
                    anchor.position[1] + sample.y - sample.size / 2 > panTop,
                );
                assert.ok(
                    Math.hypot(sample.x, sample.z) +
                        (sample.size * Math.SQRT2) / 2 <
                        anchor.radius,
                );
                assert.ok(sample.y + sample.size / 2 < 0.33);
            }
        }
    }
});
