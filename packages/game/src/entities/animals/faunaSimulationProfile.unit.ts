import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createFaunaSimulationProfile,
    type FaunaSimulationProfileStats,
} from './faunaSimulationProfile';

test('aggregates independent root owners and removes only the disposed snapshot', () => {
    let published: FaunaSimulationProfileStats | undefined;
    const getPublished = () => published;
    const profile = createFaunaSimulationProfile((stats) => {
        published = stats;
    });
    const firstStats = {
        simulationCallbacks: 2,
        renderCallbacks: 3,
        animationCallbacks: 4,
        stepCount: 5,
        renderCount: 6,
    };
    const first = profile.register(firstStats);
    const second = profile.register({
        simulationCallbacks: 7,
        renderCallbacks: 8,
        animationCallbacks: 9,
        stepCount: 10,
        renderCount: 11,
    });
    assert.deepEqual(published, {
        rootCount: 2,
        simulationCallbacks: 9,
        renderCallbacks: 11,
        animationCallbacks: 13,
        stepCount: 15,
        renderCount: 17,
    });
    firstStats.simulationCallbacks = 100;
    second.update({
        simulationCallbacks: 1,
        renderCallbacks: 2,
        animationCallbacks: 3,
        stepCount: 4,
        renderCount: 5,
    });
    assert.equal(getPublished()?.simulationCallbacks, 3);
    first.dispose();
    assert.deepEqual(published, {
        rootCount: 1,
        simulationCallbacks: 1,
        renderCallbacks: 2,
        animationCallbacks: 3,
        stepCount: 4,
        renderCount: 5,
    });
    first.update(firstStats);
    assert.equal(getPublished()?.simulationCallbacks, 1);
    second.dispose();
    assert.equal(published, undefined);
    second.dispose();
    const remounted = profile.register({
        simulationCallbacks: 1,
        renderCallbacks: 1,
        animationCallbacks: 1,
        stepCount: 0,
        renderCount: 0,
    });
    assert.equal(getPublished()?.rootCount, 1);
    assert.equal(getPublished()?.stepCount, 0);
    remounted.dispose();
    assert.equal(published, undefined);
});
