import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getInstancedInteractionMountProfileMetadata,
    getPickupPointerMoveCancelDistance,
    resolveInstancedDeferredSelectionClick,
    resolveInstancedInteractionTargetReconciliation,
    resolveInstancedRotationTap,
} from './instancedBlockInteractionCore';

describe('instanced block interaction pointer policy', () => {
    it('keeps the existing desktop and touch pickup movement thresholds', () => {
        assert.equal(getPickupPointerMoveCancelDistance('mouse'), 6);
        assert.equal(getPickupPointerMoveCancelDistance('pen'), 6);
        assert.equal(getPickupPointerMoveCancelDistance('touch'), 12);
    });

    it('rotates only after two stationary taps on the same resolved target', () => {
        const firstTap = resolveInstancedRotationTap({
            distance: 0,
            doubleTapThresholdMs: 320,
            now: 1_000,
            previousTap: null,
            targetKey: 'first',
            dragThreshold: 0.1,
        });
        const changedTarget = resolveInstancedRotationTap({
            distance: 0,
            doubleTapThresholdMs: 320,
            now: 1_100,
            previousTap: firstTap.nextTap,
            targetKey: 'second',
            dragThreshold: 0.1,
        });
        const secondTap = resolveInstancedRotationTap({
            distance: 0,
            doubleTapThresholdMs: 320,
            now: 1_200,
            previousTap: changedTarget.nextTap,
            targetKey: 'second',
            dragThreshold: 0.1,
        });

        assert.equal(firstTap.shouldRotate, false);
        assert.equal(changedTarget.shouldRotate, false);
        assert.equal(secondTap.shouldRotate, true);
        assert.equal(secondTap.nextTap, null);
    });

    it('cancels a rotation tap after pointer travel', () => {
        const result = resolveInstancedRotationTap({
            distance: 0.11,
            doubleTapThresholdMs: 320,
            now: 1_000,
            previousTap: {
                targetKey: 'target',
                timeStamp: 900,
            },
            targetKey: 'target',
            dragThreshold: 0.1,
        });

        assert.deepEqual(result, {
            nextTap: null,
            shouldRotate: false,
        });
    });
});

describe('instanced block interaction target reconciliation', () => {
    it('refreshes a captured target when the same key survives a stack update', () => {
        const currentTarget = { key: 'target', version: 1 };
        const refreshedTarget = { key: 'target', version: 2 };

        assert.deepEqual(
            resolveInstancedInteractionTargetReconciliation(
                currentTarget,
                new Map([[refreshedTarget.key, refreshedTarget]]),
            ),
            {
                target: refreshedTarget,
                type: 'refresh',
            },
        );
    });

    it('cancels a captured target removed by a stack update', () => {
        assert.deepEqual(
            resolveInstancedInteractionTargetReconciliation(
                { key: 'removed' },
                new Map(),
            ),
            {
                type: 'cancel',
            },
        );
    });

    it('does nothing when there is no captured target', () => {
        assert.deepEqual(
            resolveInstancedInteractionTargetReconciliation(null, new Map()),
            {
                type: 'none',
            },
        );
    });
});

describe('instanced deferred selection click policy', () => {
    it('does not cancel another target pending selection', () => {
        assert.deepEqual(
            resolveInstancedDeferredSelectionClick({
                clickCount: 1,
                pendingTargetKeys: new Set(['raised-bed']),
                suppressed: false,
                targetKey: 'garden-box',
            }),
            {
                cancelPendingTarget: false,
                shouldSchedule: true,
            },
        );
    });

    it('cancels only the same target pending selection on a double click', () => {
        assert.deepEqual(
            resolveInstancedDeferredSelectionClick({
                clickCount: 2,
                pendingTargetKeys: new Set(['raised-bed', 'garden-box']),
                suppressed: false,
                targetKey: 'raised-bed',
            }),
            {
                cancelPendingTarget: true,
                shouldSchedule: false,
            },
        );
    });

    it('does not schedule suppressed interactions', () => {
        assert.deepEqual(
            resolveInstancedDeferredSelectionClick({
                clickCount: 1,
                pendingTargetKeys: new Set<string>(),
                suppressed: true,
                targetKey: 'raised-bed',
            }),
            {
                cancelPendingTarget: false,
                shouldSchedule: false,
            },
        );
    });
});

describe('instanced block interaction mount profile', () => {
    it('reports one shared controller for a dense target set', () => {
        assert.deepEqual(
            getInstancedInteractionMountProfileMetadata({
                mounted: true,
                targetCount: 625,
            }),
            {
                instancedInteractionControllerCount: 1,
                instancedInteractionTargetCount: 625,
            },
        );
    });

    it('clears controller and target counts on unmount', () => {
        assert.deepEqual(
            getInstancedInteractionMountProfileMetadata({
                mounted: false,
                targetCount: 625,
            }),
            {
                instancedInteractionControllerCount: 0,
                instancedInteractionTargetCount: 0,
            },
        );
    });
});
