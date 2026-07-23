import assert from 'node:assert/strict';
import test from 'node:test';
import { getScenarioRequest, resolveScenarios } from './profile-game-scene.mjs';

test('plant closeup scenario set resolves deterministic desktop and mobile runs', () => {
    const scenarios = resolveScenarios('plant-closeup');

    assert.deepEqual(
        scenarios.map((scenario) => scenario.name),
        ['game-plant-heavy-closeup-desktop', 'game-plant-heavy-closeup-mobile'],
    );
    for (const scenario of scenarios) {
        assert.equal(scenario.plantCloseup.raisedBedId, 29);
        assert.equal(scenario.plantCloseup.repeat, 3);
        assert.match(scenario.path, /closeupRaisedBedId=29/);
        assert.match(scenario.path, /profile=plant-heavy/);
    }
});

test('profile request reads the deterministic closeup target', () => {
    const request = getScenarioRequest(
        '/debug/profile/game?profile=plant-heavy&quality=medium&closeupRaisedBedId=29',
    );

    assert.equal(request.closeupRaisedBedId, 29);
    assert.equal(request.gardenProfile, 'plant-heavy');
    assert.equal(request.quality, 'medium');
});
