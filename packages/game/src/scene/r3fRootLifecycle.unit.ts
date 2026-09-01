import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RootState } from '@react-three/fiber';
import {
    installR3FRootFrameloopVisibility,
    type R3FRootFrameloopStore,
    resolveSceneSpringContext,
} from './r3fRootLifecycle';

type TestRoot = ReturnType<typeof createTestRoot>;

function createTestRoot(frameloop: RootState['frameloop'] = 'demand') {
    const listeners = new Set<
        Parameters<R3FRootFrameloopStore['subscribe']>[0]
    >();
    const clock = { elapsedTime: 42 };
    const state = {
        clock,
        frameloop,
        internal: { frames: 0 },
        setFrameloop: (nextFrameloop: RootState['frameloop']) => {
            clock.elapsedTime = 0;
            store.setState({ frameloop: nextFrameloop });
        },
    };
    const store: R3FRootFrameloopStore = {
        getState: () => state,
        setState: (nextState) => {
            Object.assign(state, nextState);
            for (const listener of [...listeners]) {
                listener(state);
            }
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
    const moduleInvalidate = () => {
        if (state.frameloop !== 'never') {
            state.internal.frames = 1;
        }
    };
    // R3F registers this store subscriber before SceneTime mounts.
    const unsubscribeR3F = store.subscribe(moduleInvalidate);
    const rawSetFrameloop = state.setFrameloop;

    return {
        clock,
        moduleInvalidate,
        rawSetFrameloop,
        state,
        store,
        unsubscribeR3F,
    };
}

function installVisibility(
    root: TestRoot,
    {
        enabled = true,
        owner = Symbol('root-lifecycle-owner'),
    }: { enabled?: boolean; owner?: symbol } = {},
) {
    return installR3FRootFrameloopVisibility({
        enabled,
        owner,
        store: root.store,
    });
}

async function flushLifecycleCleanup() {
    await Promise.resolve();
}

describe('R3F root visibility lifecycle', () => {
    it('switches an ordinary demand root to never while hidden and restores demand on resume', async () => {
        const root = createTestRoot();
        const lifecycle = installVisibility(root);

        lifecycle.setVisible(false);
        assert.equal(lifecycle.managed, true);
        assert.equal(root.state.frameloop, 'never');
        assert.equal(root.state.internal.frames, 0);

        lifecycle.setVisible(true);
        assert.equal(root.state.frameloop, 'demand');

        lifecycle.release();
        await flushLifecycleCleanup();
        root.unsubscribeR3F();
    });

    it('restores a suspended demand root on unmount', async () => {
        const root = createTestRoot();
        const lifecycle = installVisibility(root);

        lifecycle.setVisible(false);
        lifecycle.release();
        assert.equal(root.state.frameloop, 'never');

        await flushLifecycleCleanup();
        assert.equal(root.state.frameloop, 'demand');
        root.unsubscribeR3F();
    });

    it('shields hidden roots from direct and store-subscription module invalidation', async () => {
        const root = createTestRoot();
        const lifecycle = installVisibility(root);

        root.state.internal.frames = 1;
        lifecycle.setVisible(false);
        assert.equal(root.state.internal.frames, 0);

        root.moduleInvalidate();
        assert.equal(root.state.internal.frames, 0);

        // R3F configuration can attempt to restore the Canvas prop while the
        // root is hidden. Its earlier subscriber queues a frame first; the
        // lifecycle listener synchronously reinstates the shield and clears it.
        root.store.setState({ frameloop: 'demand' });
        assert.equal(root.state.frameloop, 'never');
        assert.equal(root.state.internal.frames, 0);

        root.store.setState({ frameloop: 'always' });
        assert.equal(root.state.frameloop, 'never');
        assert.equal(root.state.internal.frames, 0);

        lifecycle.release();
        await flushLifecycleCleanup();
        root.unsubscribeR3F();
    });

    it('preserves Three clock time when Canvas reasserts its prop while hidden', async () => {
        const root = createTestRoot();
        const lifecycle = installVisibility(root);

        lifecycle.setVisible(false);
        assert.equal(root.clock.elapsedTime, 42);
        root.state.setFrameloop('demand');
        assert.equal(root.state.frameloop, 'never');
        assert.equal(root.clock.elapsedTime, 42);

        root.state.setFrameloop('always');
        assert.equal(root.state.frameloop, 'never');
        assert.equal(root.clock.elapsedTime, 42);

        lifecycle.setVisible(true);
        assert.equal(root.state.frameloop, 'always');
        assert.equal(root.clock.elapsedTime, 42);
        lifecycle.setVisible(false);
        lifecycle.release();
        await flushLifecycleCleanup();
        assert.equal(root.state.frameloop, 'always');
        assert.equal(root.clock.elapsedTime, 42);
        assert.equal(root.state.setFrameloop, root.rawSetFrameloop);
        root.unsubscribeR3F();
    });

    it('retains suspension across StrictMode cleanup and replay', async () => {
        const root = createTestRoot();
        const owner = Symbol('strict-mode-root-lifecycle');
        const first = installVisibility(root, { owner });
        first.setVisible(false);
        first.release();

        const second = installVisibility(root, { owner });
        second.setVisible(false);
        await flushLifecycleCleanup();

        assert.equal(root.state.frameloop, 'never');
        second.release();
        await flushLifecycleCleanup();
        assert.equal(root.state.frameloop, 'demand');
        root.unsubscribeR3F();
    });

    it('rejects duplicate live ownership but permits takeover during deferred release', async () => {
        const root = createTestRoot();
        const first = installVisibility(root, {
            owner: Symbol('first-root-lifecycle'),
        });

        assert.throws(
            () =>
                installVisibility(root, {
                    owner: Symbol('duplicate-root-lifecycle'),
                }),
            /Only one visibility lifecycle can own an R3F root frameloop/,
        );

        first.setVisible(false);
        first.release();
        const replacement = installVisibility(root, {
            owner: Symbol('replacement-root-lifecycle'),
        });
        replacement.setVisible(false);
        await flushLifecycleCleanup();
        assert.equal(root.state.frameloop, 'never');

        replacement.release();
        await flushLifecycleCleanup();
        assert.equal(root.state.frameloop, 'demand');
        root.unsubscribeR3F();
    });

    it('isolates visibility and pending frame state across roots', async () => {
        const firstRoot = createTestRoot();
        const secondRoot = createTestRoot();
        const first = installVisibility(firstRoot);
        const second = installVisibility(secondRoot);

        first.setVisible(false);
        firstRoot.moduleInvalidate();
        secondRoot.moduleInvalidate();

        assert.equal(firstRoot.state.frameloop, 'never');
        assert.equal(firstRoot.state.internal.frames, 0);
        assert.equal(secondRoot.state.frameloop, 'demand');
        assert.equal(secondRoot.state.internal.frames, 1);

        first.release();
        second.release();
        await flushLifecycleCleanup();
        firstRoot.unsubscribeR3F();
        secondRoot.unsubscribeR3F();
    });

    it('does not manage manual or non-demand roots', async () => {
        const manualRoot = createTestRoot();
        const manual = installVisibility(manualRoot, { enabled: false });
        manual.setVisible(false);
        assert.equal(manual.managed, false);
        assert.equal(manualRoot.state.frameloop, 'demand');

        const manualNeverRoot = createTestRoot('never');
        const manualNever = installVisibility(manualNeverRoot, {
            enabled: false,
        });
        manualNever.setVisible(false);
        assert.equal(manualNever.managed, false);
        assert.equal(manualNeverRoot.state.frameloop, 'never');

        const alwaysRoot = createTestRoot('always');
        const always = installVisibility(alwaysRoot);
        always.setVisible(false);
        assert.equal(always.managed, false);
        assert.equal(alwaysRoot.state.frameloop, 'always');

        const neverRoot = createTestRoot('never');
        const never = installVisibility(neverRoot);
        never.setVisible(true);
        assert.equal(never.managed, false);
        assert.equal(neverRoot.state.frameloop, 'never');

        manual.release();
        manualNever.release();
        always.release();
        never.release();
        await flushLifecycleCleanup();
        manualRoot.unsubscribeR3F();
        manualNeverRoot.unsubscribeR3F();
        alwaysRoot.unsubscribeR3F();
        neverRoot.unsubscribeR3F();
    });
});

describe('scene spring runtime context', () => {
    it('pauses only visibility-managed hidden roots and resumes without changing other defaults', () => {
        const inherited = { immediate: false, pause: false };

        assert.deepEqual(
            resolveSceneSpringContext({
                context: inherited,
                manualFrameloop: false,
                runtimeVisible: false,
                visibilityManaged: true,
            }),
            { immediate: false, pause: true },
        );
        assert.deepEqual(
            resolveSceneSpringContext({
                context: inherited,
                manualFrameloop: false,
                runtimeVisible: true,
                visibilityManaged: true,
            }),
            { immediate: false, pause: false },
        );
        assert.deepEqual(
            resolveSceneSpringContext({
                context: inherited,
                manualFrameloop: false,
                runtimeVisible: false,
                visibilityManaged: false,
            }),
            { immediate: false, pause: false },
        );
    });

    it('makes manual roots immediate without pausing or losing inherited defaults', () => {
        assert.deepEqual(
            resolveSceneSpringContext({
                context: { immediate: false, pause: false },
                manualFrameloop: true,
                runtimeVisible: false,
                visibilityManaged: false,
            }),
            { immediate: true, pause: false },
        );
        assert.deepEqual(
            resolveSceneSpringContext({
                context: { immediate: true, pause: true },
                manualFrameloop: false,
                runtimeVisible: true,
                visibilityManaged: true,
            }),
            { immediate: true, pause: true },
        );
    });

    it('preserves an inherited pause and isolates sibling root values', () => {
        const inherited = { pause: false };
        const hiddenRoot = resolveSceneSpringContext({
            context: inherited,
            manualFrameloop: false,
            runtimeVisible: false,
            visibilityManaged: true,
        });
        const visibleRoot = resolveSceneSpringContext({
            context: inherited,
            manualFrameloop: false,
            runtimeVisible: true,
            visibilityManaged: true,
        });
        const parentPausedRoot = resolveSceneSpringContext({
            context: { immediate: true, pause: true },
            manualFrameloop: false,
            runtimeVisible: true,
            visibilityManaged: true,
        });

        assert.equal(hiddenRoot.pause, true);
        assert.equal(visibleRoot.pause, false);
        assert.equal(inherited.pause, false);
        assert.deepEqual(parentPausedRoot, { immediate: true, pause: true });
    });
});
