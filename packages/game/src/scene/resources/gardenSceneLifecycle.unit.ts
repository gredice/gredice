import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createGardenSceneManifestProfile,
    GardenSceneLifecycle,
} from './gardenSceneLifecycle';
import { createGardenSceneManifest } from './gardenSceneManifest';

function createLifecycle() {
    let now = 100;
    const lifecycle = new GardenSceneLifecycle(() => now);
    return {
        lifecycle,
        advance(ms: number) {
            now += ms;
        },
    };
}

describe('garden scene lifecycle', () => {
    it('reaches first nonblank frame only after current assets are resident', () => {
        const { lifecycle, advance } = createLifecycle();
        lifecycle.setGarden(1);
        advance(10);
        lifecycle.frame();
        assert.equal(lifecycle.getSnapshot().state, 'loading');

        lifecycle.setCurrentReady(true);
        advance(15);
        lifecycle.frame();
        const snapshot = lifecycle.getSnapshot();
        assert.equal(snapshot.state, 'first-nonblank-frame');
        assert.equal(snapshot.firstNonblankFrameMs, 25);
        assert.equal(snapshot.interactionReadyMs, null);
    });

    it('becomes interaction-ready without needing another frame', () => {
        const { lifecycle, advance } = createLifecycle();
        lifecycle.setGarden(1);
        lifecycle.setCurrentReady(true);
        lifecycle.frame();
        advance(40);
        lifecycle.setInteractive(true);

        const snapshot = lifecycle.getSnapshot();
        assert.equal(snapshot.state, 'interaction-ready');
        assert.equal(snapshot.interactionReadyMs, 40);
    });

    it('restarts timing on every garden switch', () => {
        const { lifecycle, advance } = createLifecycle();
        lifecycle.setGarden(1);
        lifecycle.setCurrentReady(true);
        lifecycle.setInteractive(true);
        lifecycle.frame();

        advance(1_000);
        assert.equal(lifecycle.setGarden(2), true);
        assert.equal(lifecycle.setGarden(2), false);
        const snapshot = lifecycle.getSnapshot();
        assert.equal(snapshot.state, 'loading');
        assert.equal(snapshot.switches, 1);
        assert.equal(snapshot.startedAtMs, 1_100);
        assert.equal(snapshot.firstNonblankFrameMs, null);
    });

    it('does not report frames while the renderer context is lost', () => {
        const { lifecycle } = createLifecycle();
        lifecycle.setGarden(1);
        lifecycle.setCurrentReady(true);
        lifecycle.contextLost();
        lifecycle.contextLost();
        lifecycle.frame();
        assert.equal(lifecycle.getSnapshot().state, 'loading');

        lifecycle.contextRestored();
        lifecycle.frame();
        const snapshot = lifecycle.getSnapshot();
        assert.equal(snapshot.state, 'first-nonblank-frame');
        assert.equal(snapshot.contextLosses, 1);
        assert.equal(snapshot.contextRestorations, 1);
    });

    it('revokes readiness on context loss until a restored frame', () => {
        const { lifecycle, advance } = createLifecycle();
        lifecycle.setGarden(1);
        lifecycle.setCurrentReady(true);
        lifecycle.setInteractive(true);
        advance(20);
        lifecycle.frame();
        assert.equal(lifecycle.getSnapshot().state, 'interaction-ready');

        lifecycle.contextLost();
        assert.equal(lifecycle.getSnapshot().state, 'loading');
        lifecycle.setInteractive(true);
        assert.equal(lifecycle.getSnapshot().state, 'loading');

        lifecycle.contextRestored();
        assert.equal(lifecycle.getSnapshot().state, 'loading');
        advance(500);
        lifecycle.frame();
        const snapshot = lifecycle.getSnapshot();
        assert.equal(snapshot.state, 'interaction-ready');
        // Timings still describe the garden's first load.
        assert.equal(snapshot.firstNonblankFrameMs, 20);
        assert.equal(snapshot.interactionReadyMs, 20);
    });

    it('summarizes the manifest for profiles', () => {
        const current = createGardenSceneManifest({
            blockNames: ['Block_Ground', 'DogHouse'],
            gardenId: 3,
        });
        const next = createGardenSceneManifest({
            blockNames: ['Block_Sand'],
            gardenId: 4,
        });

        assert.deepEqual(createGardenSceneManifestProfile(current, next), {
            version: 1,
            key: current.key,
            gardenId: 3,
            assets: ['BlockGround', 'DogHouse'],
            idleAssets: ['Dog'],
            families: ['fauna:dogs'],
            shaderVariants: [],
            unknownBlockNames: [],
            nextGardenId: 4,
            nextKey: next.key,
        });
        assert.equal(createGardenSceneManifestProfile(null, next), undefined);
    });
});
