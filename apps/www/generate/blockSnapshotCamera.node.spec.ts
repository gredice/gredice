import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getOrthographicSnapshotCamera,
    getStandardBlockSnapshotBaseRotation,
    parseBlockSnapshotCameraView,
} from './blockSnapshotCamera.ts';

test('parseBlockSnapshotCameraView accepts only the opt-in mode', () => {
    assert.equal(parseBlockSnapshotCameraView(undefined), 'default');
    assert.equal(parseBlockSnapshotCameraView('orthographic'), 'orthographic');
    assert.throws(
        () => parseBlockSnapshotCameraView('front'),
        /must be unset or "orthographic"/,
    );
    assert.throws(
        () => parseBlockSnapshotCameraView(''),
        /must be unset or "orthographic"/,
    );
});

test('standard snapshots show animal houses from their authored front', () => {
    for (const entityName of [
        'BirdHouse',
        'ChickenCoop',
        'DogHouse',
        'PigletPen',
    ]) {
        assert.equal(getStandardBlockSnapshotBaseRotation(entityName), 2);
    }

    assert.equal(getStandardBlockSnapshotBaseRotation('RaisedBed'), 0);
});

test('orthographic camera stays fixed while rotations expose four cardinal faces', () => {
    const centerHeight = 1.65 * 0.45;
    const views = [
        getOrthographicSnapshotCamera({
            height: 1.65,
            itemPosition: [1.25, 0, 0.75],
            rotation: 0,
            span: { depth: 2, width: 1 },
        }),
        getOrthographicSnapshotCamera({
            height: 1.65,
            itemPosition: [0.75, 0, 1.25],
            rotation: 1,
            span: { depth: 1, width: 2 },
        }),
        getOrthographicSnapshotCamera({
            height: 1.65,
            itemPosition: [1.25, 0, 0.75],
            rotation: 2,
            span: { depth: 2, width: 1 },
        }),
        getOrthographicSnapshotCamera({
            height: 1.65,
            itemPosition: [0.75, 0, 1.25],
            rotation: 3,
            span: { depth: 1, width: 2 },
        }),
    ];

    assert.deepEqual(
        views.map((view) => view.label),
        ['front', 'right', 'back', 'left'],
    );
    assert.deepEqual(
        views.map((view) => view.cameraTarget),
        Array.from({ length: 4 }, () => [1.25, centerHeight, 1.25]),
    );
    assert.deepEqual(
        views.map((view) => view.cameraPosition),
        Array.from({ length: 4 }, () => [1.25, centerHeight, 101.25]),
    );
});

test('orthographic camera centers the default single-cell placement', () => {
    assert.deepEqual(
        getOrthographicSnapshotCamera({
            height: 0.4,
            rotation: 0,
            span: { depth: 1, width: 1 },
        }),
        {
            cameraPosition: [0.5, 0.18000000000000002, 100.5],
            cameraTarget: [0.5, 0.18000000000000002, 0.5],
            cameraUp: [0, 1, 0],
            label: 'front',
        },
    );
});

test('orthographic labels honor an entity-specific front rotation', () => {
    assert.deepEqual(
        [0, 1, 2, 3].map(
            (rotation) =>
                getOrthographicSnapshotCamera({
                    frontRotation: 1,
                    height: 1.65,
                    rotation,
                    span: { depth: 1, width: 1 },
                }).label,
        ),
        ['left', 'front', 'right', 'back'],
    );
});
