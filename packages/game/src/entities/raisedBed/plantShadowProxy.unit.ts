import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
    buildRaisedBedPlantShadowProxyMatrices,
    GENERATED_PLANT_SHADOW_LAYER,
} from './plantShadowProxy';

test('plant shadow proxies preserve root placement and conservative size', () => {
    const [matrix] = buildRaisedBedPlantShadowProxyMatrices([
        {
            canopyWidth: 0.8,
            height: 1.5,
            position: [2, -0.7, 4],
            scale: 0.5,
            stemWidth: 0.1,
        },
    ]);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);

    assert.deepEqual(position.toArray(), [2, -0.7, 4]);
    assert.equal(scale.y, 0.75);
    assert.ok(scale.x >= 0.16);
    assert.equal(scale.x, scale.z);
});

test('plant shadow proxies retain nonzero bounds for young plants', () => {
    const [matrix] = buildRaisedBedPlantShadowProxyMatrices([
        {
            canopyWidth: 0,
            height: 0,
            position: [0, 0, 0],
            scale: 1,
            stemWidth: 0,
        },
    ]);
    const scale = new THREE.Vector3();
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

    assert.ok(scale.x > 0);
    assert.ok(scale.y > 0);
});

test('plant shadow proxies use a non-default render layer', () => {
    assert.notEqual(GENERATED_PLANT_SHADOW_LAYER, 0);
});
