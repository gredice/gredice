import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RootState } from '@react-three/fiber';
import {
    installR3FRootInvalidationBroker,
    type R3FRootInvalidationStore,
    readRawR3FRootInvalidate,
} from './r3fRootInvalidationBroker';

type TestRoot = ReturnType<typeof createTestRoot>;

function createTestRoot(frameloop: RootState['frameloop'] = 'demand') {
    let rawInvalidationCount = 0;
    const rawInvalidate = () => {
        rawInvalidationCount += 1;
    };
    const state: ReturnType<R3FRootInvalidationStore['getState']> = {
        frameloop,
        invalidate: rawInvalidate,
    };
    const store: R3FRootInvalidationStore = {
        getState: () => state,
        setState: (nextState) => {
            Object.assign(state, nextState);
        },
    };
    return {
        get rawInvalidationCount() {
            return rawInvalidationCount;
        },
        rawInvalidate,
        state,
        store,
    };
}

function installBroker({
    enabled = true,
    isFrameRendering = () => false,
    owner = Symbol('test-root-owner'),
    requestCoalescedRender = () => true,
    root,
}: {
    enabled?: boolean;
    isFrameRendering?: () => boolean;
    owner?: symbol;
    requestCoalescedRender?: (reason: string, frames?: number) => boolean;
    root: TestRoot;
}) {
    return installR3FRootInvalidationBroker({
        isEnabled: () => enabled,
        isFrameRendering,
        owner,
        rawInvalidate: readRawR3FRootInvalidate(root.store),
        requestCoalescedRender,
        store: root.store,
    });
}

async function flushBrokerCleanup() {
    await Promise.resolve();
}

describe('R3F root invalidation broker', () => {
    it('routes demand invalidation through the scheduler while its captured raw effect cannot recurse', async () => {
        const root = createTestRoot();
        const rawInvalidate = readRawR3FRootInvalidate(root.store);
        const requests: Array<{ frames: number | undefined; reason: string }> =
            [];
        const release = installBroker({
            requestCoalescedRender: (reason, frames) => {
                requests.push({ frames, reason });
                rawInvalidate();
                return true;
            },
            root,
        });

        root.state.invalidate(3);

        assert.deepEqual(requests, [{ frames: 3, reason: 'r3f-root-update' }]);
        assert.equal(root.rawInvalidationCount, 1);

        release();
        await flushBrokerCleanup();
    });

    it('retains the native follow-up frame for default and one-frame invalidations during a render', async () => {
        const root = createTestRoot();
        let frameRendering = false;
        const requests: Array<number | undefined> = [];
        const release = installBroker({
            isFrameRendering: () => frameRendering,
            requestCoalescedRender: (_reason, frames) => {
                requests.push(frames);
                return true;
            },
            root,
        });

        root.state.invalidate();
        root.state.invalidate(1);
        frameRendering = true;
        root.state.invalidate();
        root.state.invalidate(1);
        root.state.invalidate(0.5);
        root.state.invalidate(3);

        assert.deepEqual(requests, [undefined, 1, 2, 2, 2, 3]);
        assert.equal(root.rawInvalidationCount, 0);

        release();
        await flushBrokerCleanup();
    });

    it('preserves native fallback semantics for non-positive frame counts', async () => {
        const root = createTestRoot();
        let requestCount = 0;
        const release = installBroker({
            isFrameRendering: () => true,
            requestCoalescedRender: () => {
                requestCount += 1;
                return true;
            },
            root,
        });

        root.state.invalidate(0);
        root.state.invalidate(-1);

        assert.equal(requestCount, 0);
        assert.equal(root.rawInvalidationCount, 2);

        release();
        await flushBrokerCleanup();
    });

    it('bypasses scheduling when disabled, outside demand mode, or rejected', async () => {
        const disabledRoot = createTestRoot();
        let disabledRequestCount = 0;
        const releaseDisabled = installBroker({
            enabled: false,
            requestCoalescedRender: () => {
                disabledRequestCount += 1;
                return true;
            },
            root: disabledRoot,
        });
        disabledRoot.state.invalidate();
        assert.equal(disabledRequestCount, 0);
        assert.equal(disabledRoot.rawInvalidationCount, 1);

        const alwaysRoot = createTestRoot('always');
        let alwaysRequestCount = 0;
        const releaseAlways = installBroker({
            requestCoalescedRender: () => {
                alwaysRequestCount += 1;
                return true;
            },
            root: alwaysRoot,
        });
        alwaysRoot.state.invalidate();
        assert.equal(alwaysRequestCount, 0);
        assert.equal(alwaysRoot.rawInvalidationCount, 1);

        const rejectedRoot = createTestRoot();
        const releaseRejected = installBroker({
            requestCoalescedRender: () => false,
            root: rejectedRoot,
        });
        rejectedRoot.state.invalidate();
        assert.equal(rejectedRoot.rawInvalidationCount, 1);

        releaseDisabled();
        releaseAlways();
        releaseRejected();
        await flushBrokerCleanup();
    });

    it('retains broker ownership across StrictMode cleanup and replay', async () => {
        const root = createTestRoot();
        const owner = Symbol('strict-mode-owner');
        const firstRelease = installBroker({ owner, root });
        const brokerInvalidate = root.state.invalidate;

        firstRelease();
        const secondRelease = installBroker({ owner, root });
        await flushBrokerCleanup();

        assert.equal(root.state.invalidate, brokerInvalidate);
        secondRelease();
        await flushBrokerCleanup();
        assert.equal(root.state.invalidate, root.rawInvalidate);
    });

    it('does not overwrite an invalidate replacement installed by another owner', async () => {
        const root = createTestRoot();
        const release = installBroker({ root });
        const replacementInvalidate = () => undefined;
        root.store.setState({ invalidate: replacementInvalidate });

        release();
        await flushBrokerCleanup();

        assert.equal(root.state.invalidate, replacementInvalidate);
    });

    it('rejects duplicate live ownership but permits takeover during deferred release', async () => {
        const root = createTestRoot();
        const firstOwner = Symbol('first-owner');
        const firstRelease = installBroker({ owner: firstOwner, root });

        assert.throws(
            () => installBroker({ owner: Symbol('duplicate-owner'), root }),
            /Only one game runtime invalidation broker can own an R3F root/,
        );

        firstRelease();
        const secondRelease = installBroker({
            owner: Symbol('replacement-owner'),
            root,
        });
        await flushBrokerCleanup();
        assert.notEqual(root.state.invalidate, root.rawInvalidate);

        secondRelease();
        await flushBrokerCleanup();
        assert.equal(root.state.invalidate, root.rawInvalidate);
    });

    it('isolates broker state and raw invalidation across roots', async () => {
        const firstRoot = createTestRoot();
        const secondRoot = createTestRoot();
        let firstRequestCount = 0;
        let secondRequestCount = 0;
        const releaseFirst = installBroker({
            requestCoalescedRender: () => {
                firstRequestCount += 1;
                return true;
            },
            root: firstRoot,
        });
        const releaseSecond = installBroker({
            requestCoalescedRender: () => {
                secondRequestCount += 1;
                return true;
            },
            root: secondRoot,
        });

        firstRoot.state.invalidate();
        assert.equal(firstRequestCount, 1);
        assert.equal(secondRequestCount, 0);
        secondRoot.state.invalidate();
        assert.equal(firstRequestCount, 1);
        assert.equal(secondRequestCount, 1);

        releaseFirst();
        releaseSecond();
        await flushBrokerCleanup();
    });
});
