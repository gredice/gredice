import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
    buildGeneratedPlantRaisedBedBounds,
    getGeneratedPlantBatchKey,
    isGeneratedPlantRaisedBedGroupVisible,
    resolveGeneratedPlantFieldLod,
} from './generatedPlantFieldLod';

test('selected raised beds keep exact near detail throughout close-up', () => {
    assert.equal(
        resolveGeneratedPlantFieldLod({
            cameraZoom: 20,
            currentLevel: 'far',
            focusActive: true,
            isSelectedRaisedBed: true,
            screenOccupancy: 0.001,
        }),
        'near',
    );
});

test('close-up zoom cannot promote a background raised bed to near', () => {
    assert.equal(
        resolveGeneratedPlantFieldLod({
            cameraZoom: 300,
            currentLevel: 'near',
            focusActive: true,
            isSelectedRaisedBed: false,
            screenOccupancy: 1,
        }),
        'mid',
    );
});

test('normal-view LOD policy remains unchanged', () => {
    assert.equal(
        resolveGeneratedPlantFieldLod({
            cameraZoom: 180,
            currentLevel: 'far',
            focusActive: false,
            isSelectedRaisedBed: false,
            screenOccupancy: 0.001,
        }),
        'near',
    );
    assert.equal(
        resolveGeneratedPlantFieldLod({
            cameraZoom: 0,
            currentLevel: 'far',
            focusActive: false,
            isSelectedRaisedBed: false,
            screenOccupancy: 0.06,
        }),
        'mid',
    );
});

test('raised-bed bounds cover field spread and tall plants', () => {
    const bounds = buildGeneratedPlantRaisedBedBounds([
        {
            approximatePlantHeight: 0.5,
            position: [0, -0.75, 0],
        },
        {
            approximatePlantHeight: 2,
            position: [1, -0.75, 0],
        },
    ]);

    assert.equal(
        bounds.containsPoint(new THREE.Vector3(-0.4, -0.75, -0.4)),
        true,
    );
    assert.equal(bounds.containsPoint(new THREE.Vector3(1.4, 1.25, 0.4)), true);
});

test('offscreen groups are rejected while the selected group bypasses culling', () => {
    const frustum = new THREE.Frustum(
        new THREE.Plane(new THREE.Vector3(1, 0, 0), 1),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 1),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), 1),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), 1),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), 1),
    );
    const offscreenBounds = new THREE.Sphere(new THREE.Vector3(10, 0, 0), 0.5);

    assert.equal(
        isGeneratedPlantRaisedBedGroupVisible({
            bounds: offscreenBounds,
            focusActive: false,
            frustum,
            isSelectedRaisedBed: false,
        }),
        false,
    );
    assert.equal(
        isGeneratedPlantRaisedBedGroupVisible({
            bounds: offscreenBounds,
            focusActive: true,
            frustum,
            isSelectedRaisedBed: true,
        }),
        true,
    );
});

test('focused and background fields cannot share a generated-plant batch', () => {
    assert.notEqual(
        getGeneratedPlantBatchKey({
            focused: true,
            lodLevel: 'near',
            plantType: 'tomato',
            raisedBedId: 29,
        }),
        getGeneratedPlantBatchKey({
            focused: false,
            lodLevel: 'near',
            plantType: 'tomato',
            raisedBedId: 1,
        }),
    );
});
