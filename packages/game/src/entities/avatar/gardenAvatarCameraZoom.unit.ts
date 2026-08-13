import assert from 'node:assert/strict';
import test from 'node:test';
import {
    defaultGardenAvatarCameraZoom,
    getGardenAvatarCameraFov,
    scaleGardenAvatarCameraZoom,
} from './gardenAvatarCameraZoom';

test('zooms the avatar camera in and out around its default framing', () => {
    assert.ok(
        scaleGardenAvatarCameraZoom(defaultGardenAvatarCameraZoom, 1.15) >
            defaultGardenAvatarCameraZoom,
    );
    assert.ok(
        scaleGardenAvatarCameraZoom(defaultGardenAvatarCameraZoom, 1 / 1.15) <
            defaultGardenAvatarCameraZoom,
    );
});

test('clamps avatar camera zoom and rejects invalid scale input', () => {
    assert.equal(scaleGardenAvatarCameraZoom(1, 0.01), 0.75);
    assert.equal(scaleGardenAvatarCameraZoom(1, 100), 1.6);
    assert.equal(scaleGardenAvatarCameraZoom(Number.NaN, -1), 1);
});

test('converts avatar camera zoom to perspective field of view', () => {
    assert.equal(getGardenAvatarCameraFov({ defaultFov: 55, zoom: 1 }), 55);
    assert.equal(
        getGardenAvatarCameraFov({ defaultFov: 55, zoom: 1.6 }),
        34.375,
    );
    assert.ok(
        Math.abs(
            getGardenAvatarCameraFov({ defaultFov: 55, zoom: 0.75 }) -
                73.333_333_333_333_33,
        ) < 0.000_001,
    );
});
