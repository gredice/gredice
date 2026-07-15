import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assertDeliveryOfflineWritesAllowed,
    blockDeliveryOfflineWritesForLogout,
    deliveryOfflineWritesBlocked,
    publishDeliverySessionResumed,
    resetDeliveryOfflineWritesForFreshDocument,
} from './deliveryOfflineEvents';

test('session resume keeps old-document writers blocked until replacement', () => {
    blockDeliveryOfflineWritesForLogout('logout-generation-one');
    publishDeliverySessionResumed();

    assert.equal(deliveryOfflineWritesBlocked(), true);
    assert.throws(
        assertDeliveryOfflineWritesAllowed,
        /Delivery logout is in progress/,
    );

    resetDeliveryOfflineWritesForFreshDocument();
    assert.equal(deliveryOfflineWritesBlocked(), false);
    assert.doesNotThrow(assertDeliveryOfflineWritesAllowed);
});

test('session generation invalidates a document that missed logout signaling', () => {
    resetDeliveryOfflineWritesForFreshDocument();
    publishDeliverySessionResumed();

    assert.equal(deliveryOfflineWritesBlocked(), true);
    assert.throws(
        assertDeliveryOfflineWritesAllowed,
        /Delivery logout is in progress/,
    );

    resetDeliveryOfflineWritesForFreshDocument();
    assert.equal(deliveryOfflineWritesBlocked(), false);
});
