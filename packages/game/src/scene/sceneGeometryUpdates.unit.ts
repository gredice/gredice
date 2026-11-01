import assert from 'node:assert/strict';
import test from 'node:test';
import { SceneGeometryUpdates } from './sceneGeometryUpdates';
import {
    consumeDeferredShadowRefresh,
    createDeferredShadowRefreshState,
    transitionDeferredShadowRefresh,
} from './shadowMapScheduling';

test('geometry leases distinguish committed results from cancellation and settle once', () => {
    const updates = new SceneGeometryUpdates();
    const commit = updates.begin();
    const cancel = updates.begin();
    assert.equal(updates.pendingCount, 2);
    assert.equal(commit(true), true);
    assert.equal(commit(true), false);
    assert.equal(commit(), false);
    assert.equal(updates.revision, 1);
    assert.equal(updates.pendingCount, 1);
    assert.equal(cancel(), true);
    assert.equal(cancel(true), false);
    assert.equal(updates.pendingCount, 0);
    assert.equal(updates.revision, 1);
});

test('pending geometry and revisions belong to their Canvas', () => {
    const first = new SceneGeometryUpdates();
    const second = new SceneGeometryUpdates();
    const finish = first.begin();
    assert.equal(second.pendingCount, 0);
    assert.equal(second.revision, 0);
    finish(true);
    assert.equal(first.revision, 1);
    assert.equal(second.revision, 0);
});

test('late geometry commits and cancelled work join one final placement shadow flush', () => {
    const updates = new SceneGeometryUpdates();
    const first = updates.begin();
    const second = updates.begin();
    const cancelled = updates.begin();
    let state = createDeferredShadowRefreshState(1);
    first(true);
    state = transitionDeferredShadowRefresh(state, {
        activePlacementCount: 0,
        geometryChanged: true,
    }).state;
    assert.equal(
        consumeDeferredShadowRefresh(state, updates.pendingCount).shouldRefresh,
        false,
    );
    cancelled();
    assert.equal(
        consumeDeferredShadowRefresh(state, updates.pendingCount).shouldRefresh,
        false,
    );
    second(true);
    state = transitionDeferredShadowRefresh(state, {
        activePlacementCount: 0,
        geometryChanged: true,
    }).state;
    const flush = consumeDeferredShadowRefresh(state, updates.pendingCount);
    assert.equal(flush.shouldRefresh, true);
    assert.equal(flush.placementFlush, true);
    assert.equal(
        consumeDeferredShadowRefresh(flush.state, updates.pendingCount)
            .shouldRefresh,
        false,
    );
});
