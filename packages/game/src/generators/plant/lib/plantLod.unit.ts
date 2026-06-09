import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolvePlantLodLevel,
    resolvePlantLodLevelWithHysteresis,
} from './plantLod';

test('plant LOD uses projected plant size at normal zoom', () => {
    assert.equal(resolvePlantLodLevel(0.13), 'near');
    assert.equal(resolvePlantLodLevel(0.05), 'mid');
    assert.equal(resolvePlantLodLevel(0.03), 'far');
});

test('plant LOD forces geometry when orthographic camera is close', () => {
    assert.equal(
        resolvePlantLodLevelWithHysteresis({
            cameraZoom: 180,
            currentLevel: 'far',
            screenOccupancy: 0.01,
        }),
        'near',
    );
});

test('plant LOD keeps close geometry through zoom hysteresis', () => {
    assert.equal(
        resolvePlantLodLevelWithHysteresis({
            cameraZoom: 161,
            currentLevel: 'near',
            screenOccupancy: 0.01,
        }),
        'near',
    );
    assert.equal(
        resolvePlantLodLevelWithHysteresis({
            cameraZoom: 159,
            currentLevel: 'near',
            screenOccupancy: 0.01,
        }),
        'far',
    );
});
