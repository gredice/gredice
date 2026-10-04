import assert from 'node:assert/strict';
import test from 'node:test';
import {
    groupOutletGardenTargetsByRaisedBed,
    hasOutletGardenAuthenticationExpired,
    outletGardenOfferFromHeldCartItem,
    resolveOutletGardenCommerceState,
    resolveOutletGardenTargetSelection,
} from './OutletGardenCommerce';

const target = (
    raisedBedId: number,
    raisedBedName: string,
    positionIndex: number,
) => ({
    positionIndex,
    raisedBedId,
    raisedBedName,
});

const readyStateInput = {
    authenticated: true,
    authenticatedQueriesPending: false,
    enabled: true,
    hasEligibleTarget: true,
    hasMutationError: false,
    hasQueryError: false,
    hasSelectedOffer: true,
    mutationPending: false,
    now: Date.parse('2026-08-12T12:00:00.000Z'),
    opened: true,
    queryRetrying: false,
    receiptHoldExpiresAt: null,
    userPending: false,
};

test('prioritizes current-user query errors over authentication-required', () => {
    assert.equal(
        resolveOutletGardenCommerceState({
            ...readyStateInput,
            authenticated: false,
            hasQueryError: true,
        }),
        'query-error',
    );
});

test('prioritizes authenticated query errors over no-targets', () => {
    assert.equal(
        resolveOutletGardenCommerceState({
            ...readyStateInput,
            hasEligibleTarget: false,
            hasQueryError: true,
        }),
        'query-error',
    );
});

test('treats a dependent unauthorized response as expired cached authentication', () => {
    assert.equal(
        hasOutletGardenAuthenticationExpired({
            authenticated: true,
            gardensUnauthorized: true,
            shoppingCartUnauthorized: false,
            targetGardenUnauthorized: false,
        }),
        true,
    );
    assert.equal(
        hasOutletGardenAuthenticationExpired({
            authenticated: false,
            gardensUnauthorized: true,
            shoppingCartUnauthorized: true,
            targetGardenUnauthorized: true,
        }),
        false,
    );
});

test('preserves mutation errors and shows loading while retrying queries', () => {
    assert.equal(
        resolveOutletGardenCommerceState({
            ...readyStateInput,
            hasMutationError: true,
            hasQueryError: true,
        }),
        'error',
    );
    assert.equal(
        resolveOutletGardenCommerceState({
            ...readyStateInput,
            hasQueryError: true,
            queryRetrying: true,
        }),
        'loading',
    );
});

test('groups free positions by raised bed in source order', () => {
    assert.deepEqual(
        groupOutletGardenTargetsByRaisedBed([
            target(22, 'Zapadna gredica', 3),
            target(22, 'Zapadna gredica', 7),
            target(11, 'Ulazna gredica', 0),
            target(11, 'Ulazna gredica', 2),
        ]),
        [
            { id: 22, name: 'Zapadna gredica' },
            { id: 11, name: 'Ulazna gredica' },
        ],
    );
});

test('preselects the first raised bed with its first free position', () => {
    const selection = resolveOutletGardenTargetSelection({
        selectedRaisedBedId: null,
        selectedTargetKey: null,
        targets: [
            target(22, 'Zapadna gredica', 3),
            target(22, 'Zapadna gredica', 7),
            target(11, 'Ulazna gredica', 0),
        ],
    });

    assert.equal(selection.selectedRaisedBedId, 22);
    assert.equal(selection.selectedTargetKey, '22:3');
    assert.deepEqual(selection.fieldTargets, [
        target(22, 'Zapadna gredica', 3),
        target(22, 'Zapadna gredica', 7),
    ]);
});

test('limits positions to the selected raised bed and preselects its first free one', () => {
    const selection = resolveOutletGardenTargetSelection({
        selectedRaisedBedId: 11,
        selectedTargetKey: '22:7',
        targets: [
            target(22, 'Zapadna gredica', 3),
            target(22, 'Zapadna gredica', 7),
            target(11, 'Ulazna gredica', 0),
            target(11, 'Ulazna gredica', 2),
        ],
    });

    assert.equal(selection.selectedRaisedBedId, 11);
    assert.equal(selection.selectedTargetKey, '11:0');
    assert.deepEqual(selection.fieldTargets, [
        target(11, 'Ulazna gredica', 0),
        target(11, 'Ulazna gredica', 2),
    ]);
});

test('reselects a free position after a target conflict refresh', () => {
    const sameRaisedBed = resolveOutletGardenTargetSelection({
        selectedRaisedBedId: 22,
        selectedTargetKey: '22:3',
        targets: [
            target(22, 'Zapadna gredica', 7),
            target(11, 'Ulazna gredica', 0),
        ],
    });
    assert.equal(sameRaisedBed.selectedRaisedBedId, 22);
    assert.equal(sameRaisedBed.selectedTargetKey, '22:7');

    const nextRaisedBed = resolveOutletGardenTargetSelection({
        selectedRaisedBedId: 22,
        selectedTargetKey: '22:7',
        targets: [target(11, 'Ulazna gredica', 0)],
    });
    assert.equal(nextRaisedBed.selectedRaisedBedId, 11);
    assert.equal(nextRaisedBed.selectedTargetKey, '11:0');
});

test('builds the receipt offer from the authoritative held cart snapshot', () => {
    const offer = outletGardenOfferFromHeldCartItem({
        entityId: '88',
        entityTypeName: 'plantSort',
        outlet: {
            comparePrice: 4.2,
            endAt: '2026-08-14T12:00:00.000Z',
            expired: false,
            initialPlantStatus: 'ready',
            offerId: 302,
            outletPrice: 1.75,
            sowingDate: '2026-07-28T00:00:00.000Z',
            status: 'held',
        },
        shopData: {
            description: 'Snapshot description',
            image: 'https://cdn.example.test/snapshot.webp',
            name: 'Snapshot paprika',
        },
    });

    assert.ok(offer);
    assert.equal(offer.id, 302);
    assert.equal(offer.outletPrice, 1.75);
    assert.equal(offer.comparePrice, 4.2);
    assert.equal(offer.initialPlantStatus, 'ready');
    assert.equal(offer.endAt, '2026-08-14T12:00:00.000Z');
    assert.equal(offer.plantSort.name, 'Snapshot paprika');
    assert.deepEqual(offer.imageUrls, [
        'https://cdn.example.test/snapshot.webp',
    ]);
});

test('rejects a cart snapshot that is no longer held', () => {
    const offer = outletGardenOfferFromHeldCartItem({
        entityId: '88',
        entityTypeName: 'plantSort',
        outlet: {
            comparePrice: null,
            endAt: '2026-08-14T12:00:00.000Z',
            expired: true,
            initialPlantStatus: 'ready',
            offerId: 302,
            outletPrice: 1.75,
            sowingDate: '2026-07-28T00:00:00.000Z',
            status: 'held',
        },
        shopData: { name: 'Snapshot paprika' },
    });

    assert.equal(offer, null);
});
