import assert from 'node:assert/strict';
import test from 'node:test';
import {
    observePushPermissionRefresh,
    pushSetupStatusAfterSubscriptionCheck,
} from './usePushPermissionOnboarding';

test('subscription check distinguishes granted permission from a live subscription', () => {
    assert.equal(
        pushSetupStatusAfterSubscriptionCheck('granted', true),
        'subscribed',
    );
    assert.equal(
        pushSetupStatusAfterSubscriptionCheck('granted', false),
        'granted',
    );
    assert.equal(
        pushSetupStatusAfterSubscriptionCheck('denied', true),
        'denied',
    );
});

test('permission refresh observes focus and visible-page changes until cleanup', () => {
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget();
    let visibilityState: DocumentVisibilityState = 'hidden';
    let refreshCount = 0;
    Object.defineProperty(documentTarget, 'visibilityState', {
        configurable: true,
        get: () => visibilityState,
    });

    const cleanup = observePushPermissionRefresh({
        documentTarget: documentTarget as unknown as Document,
        refresh: () => {
            refreshCount += 1;
        },
        windowTarget: windowTarget as unknown as Window,
    });

    windowTarget.dispatchEvent(new Event('focus'));
    assert.equal(refreshCount, 1);

    documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(refreshCount, 1);

    visibilityState = 'visible';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(refreshCount, 2);

    cleanup();
    windowTarget.dispatchEvent(new Event('focus'));
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(refreshCount, 2);
});
