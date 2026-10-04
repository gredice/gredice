import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assertOutletCartTargetAvailable,
    OutletCartMutationConflictError,
    outletCartMutationConflictCodes,
    requireOutletCartTarget,
    resolveOutletCartCurrency,
} from './outletCartTarget';

function targetGarden(
    overrides: Record<string, unknown> = {},
    raisedBedOverrides: Record<string, unknown> = {},
) {
    return {
        accountId: 'account-1',
        id: 10,
        isSandbox: false,
        raisedBeds: [
            {
                accountId: 'account-1',
                fields: [],
                gardenId: 10,
                id: 20,
                plantings: [],
                status: 'active',
                ...raisedBedOverrides,
            },
        ],
        ...overrides,
    };
}

function assertConflict(
    operation: () => unknown,
    code: OutletCartMutationConflictError['code'],
) {
    assert.throws(operation, (error) => {
        assert.ok(error instanceof OutletCartMutationConflictError);
        assert.equal(error.code, code);
        return true;
    });
}

test('outlet cart conflict codes remain stable', () => {
    assert.deepEqual(outletCartMutationConflictCodes, {
        offerUnavailable: 'OUTLET_OFFER_UNAVAILABLE',
        targetRequired: 'OUTLET_TARGET_REQUIRED',
        targetUnavailable: 'OUTLET_TARGET_UNAVAILABLE',
    });
});

test('requireOutletCartTarget returns a complete target and rejects omissions', () => {
    assert.deepEqual(
        requireOutletCartTarget({
            gardenId: 10,
            raisedBedId: 20,
            positionIndex: 3,
        }),
        { gardenId: 10, raisedBedId: 20, positionIndex: 3 },
    );
    for (const target of [
        { raisedBedId: 20, positionIndex: 3 },
        { gardenId: 10, positionIndex: 3 },
        { gardenId: 10, raisedBedId: 20 },
    ]) {
        assertConflict(
            () => requireOutletCartTarget(target),
            outletCartMutationConflictCodes.targetRequired,
        );
    }

    for (const target of [
        { gardenId: 1.5, raisedBedId: 20, positionIndex: 3 },
        { gardenId: 0, raisedBedId: 20, positionIndex: 3 },
        { gardenId: 10, raisedBedId: 20.5, positionIndex: 3 },
        { gardenId: 10, raisedBedId: 0, positionIndex: 3 },
        { gardenId: 10, raisedBedId: 20, positionIndex: -1 },
        { gardenId: 10, raisedBedId: 20, positionIndex: 18 },
    ]) {
        assertConflict(
            () => requireOutletCartTarget(target),
            outletCartMutationConflictCodes.targetUnavailable,
        );
    }
});

test('assertOutletCartTargetAvailable accepts an owned empty valid target', () => {
    assert.doesNotThrow(() =>
        assertOutletCartTargetAvailable({
            accountId: 'account-1',
            garden: targetGarden(),
            isRaisedBedValid: true,
            positionIndex: 17,
            raisedBedId: 20,
        }),
    );
});

test('assertOutletCartTargetAvailable rejects unavailable garden and bed states', () => {
    const cases = [
        { garden: null, valid: true },
        { garden: targetGarden({ accountId: 'account-2' }), valid: true },
        { garden: targetGarden({ isSandbox: true }), valid: true },
        {
            garden: targetGarden({}, { accountId: 'account-2' }),
            valid: true,
        },
        { garden: targetGarden({}, { gardenId: 11 }), valid: true },
        { garden: targetGarden({}, { status: 'abandoned' }), valid: true },
        { garden: targetGarden(), valid: false },
    ];

    for (const { garden, valid } of cases) {
        assertConflict(
            () =>
                assertOutletCartTargetAvailable({
                    accountId: 'account-1',
                    garden,
                    isRaisedBedValid: valid,
                    positionIndex: 0,
                    raisedBedId: 20,
                }),
            outletCartMutationConflictCodes.targetUnavailable,
        );
    }
});

test('assertOutletCartTargetAvailable rejects positions outside the bed', () => {
    for (const positionIndex of [-1, 18, 1.5, Number.NaN]) {
        assertConflict(
            () =>
                assertOutletCartTargetAvailable({
                    accountId: 'account-1',
                    garden: targetGarden(),
                    isRaisedBedValid: true,
                    positionIndex,
                    raisedBedId: 20,
                }),
            outletCartMutationConflictCodes.targetUnavailable,
        );
    }
});

test('assertOutletCartTargetAvailable rejects active physical occupancy', () => {
    assertConflict(
        () =>
            assertOutletCartTargetAvailable({
                accountId: 'account-1',
                garden: targetGarden(
                    {},
                    {
                        fields: [
                            {
                                active: true,
                                plantSortId: 301,
                                positionIndex: 4,
                            },
                        ],
                    },
                ),
                isRaisedBedValid: true,
                positionIndex: 4,
                raisedBedId: 20,
            }),
        outletCartMutationConflictCodes.targetUnavailable,
    );
});

test('assertOutletCartTargetAvailable rejects selected-layout occupancy', () => {
    assertConflict(
        () =>
            assertOutletCartTargetAvailable({
                accountId: 'account-1',
                garden: targetGarden(
                    {},
                    {
                        plantings: [
                            {
                                configurationSource: 'selected',
                                isActive: true,
                                layoutKey: 'selected-layout',
                                memberships: [{ positionIndex: 5 }],
                            },
                        ],
                    },
                ),
                isRaisedBedValid: true,
                positionIndex: 5,
                raisedBedId: 20,
            }),
        outletCartMutationConflictCodes.targetUnavailable,
    );
});

test('assertOutletCartTargetAvailable fails closed for malformed selected occupancy', () => {
    assertConflict(
        () =>
            assertOutletCartTargetAvailable({
                accountId: 'account-1',
                garden: targetGarden(
                    {},
                    {
                        plantings: [
                            {
                                configurationSource: 'selected',
                                isActive: true,
                                layoutKey: 'selected-layout',
                                memberships: [{}],
                            },
                        ],
                    },
                ),
                isRaisedBedValid: true,
                positionIndex: 5,
                raisedBedId: 20,
            }),
        outletCartMutationConflictCodes.targetUnavailable,
    );
});

test('resolveOutletCartCurrency preserves supported currencies and normalizes inventory', () => {
    assert.equal(resolveOutletCartCurrency('sunflower', 'eur'), 'sunflower');
    assert.equal(
        resolveOutletCartCurrency(undefined, 'sunflower'),
        'sunflower',
    );
    assert.equal(resolveOutletCartCurrency(undefined, 'inventory'), 'eur');
    assert.equal(resolveOutletCartCurrency(null, undefined), 'eur');
});
