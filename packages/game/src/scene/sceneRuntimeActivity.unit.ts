import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getGameSceneRuntimeActivitySnapshot,
    registerGameSceneRuntimeActivity,
    subscribeGameSceneRuntimeActivity,
} from './sceneRuntimeActivity';

test('aggregates mounted scene visibility and defaults active without a scene', () => {
    assert.deepEqual(getGameSceneRuntimeActivitySnapshot(), {
        activeSceneCount: 0,
        registeredSceneCount: 0,
        runtimeActive: true,
    });

    let notificationCount = 0;
    const unsubscribe = subscribeGameSceneRuntimeActivity(() => {
        notificationCount += 1;
    });
    const hiddenScene = registerGameSceneRuntimeActivity(false);
    assert.deepEqual(getGameSceneRuntimeActivitySnapshot(), {
        activeSceneCount: 0,
        registeredSceneCount: 1,
        runtimeActive: false,
    });

    const visibleScene = registerGameSceneRuntimeActivity(true);
    assert.deepEqual(getGameSceneRuntimeActivitySnapshot(), {
        activeSceneCount: 1,
        registeredSceneCount: 2,
        runtimeActive: true,
    });

    visibleScene.setActive(false);
    assert.equal(getGameSceneRuntimeActivitySnapshot().runtimeActive, false);
    hiddenScene.setActive(true);
    assert.equal(getGameSceneRuntimeActivitySnapshot().runtimeActive, true);

    hiddenScene.unregister();
    visibleScene.unregister();
    unsubscribe();
    assert.deepEqual(getGameSceneRuntimeActivitySnapshot(), {
        activeSceneCount: 0,
        registeredSceneCount: 0,
        runtimeActive: true,
    });
    assert.equal(notificationCount, 6);
});
