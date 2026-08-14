import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    AdvancedSowingPlanBoundaryError,
    advancedSowingCartAuthorizationKey,
    advancedSowingCartAuthorizationKind,
    advancedSowingSelectionRequestKind,
    assertNoReservedAdvancedSowingAdditionalData,
    authorizeAdvancedSowingCartSelection,
    buildAdvancedSowingSupportedCartTarget,
    parseUntrustedAdvancedSowingCartAuthorizationV1,
    parseUntrustedAdvancedSowingSelectionRequestV1,
    readAdvancedSowingCatalogueDistanceRange,
    readAdvancedSowingPaidCheckoutSnapshot,
    validateAdvancedSowingCartAuthorizationBeforeCheckout,
} from './advancedSowingPlan';

const distanceRange = {
    maxDistanceCm: 60,
    minDistanceCm: 15,
    optimalDistanceCm: 30,
};
const target = {
    bedFieldCount: 18,
    positionIndex: 11,
};
const selectionRequest = {
    kind: advancedSowingSelectionRequestKind,
    selectedDistanceCm: 60,
    version: 1,
};

function authorize(
    overrides: Partial<
        Parameters<typeof authorizeAdvancedSowingCartSelection>[0]
    > = {},
) {
    return authorizeAdvancedSowingCartSelection({
        catalogueDistanceRange: distanceRange,
        clientAdditionalData: {
            scheduledDate: '2026-09-01T00:00:00.000Z',
            sowingLocation: 'greenhouse',
        },
        selectionRequest,
        target,
        ...overrides,
    });
}

function expectBoundaryReason(
    operation: () => unknown,
    reasonCode: AdvancedSowingPlanBoundaryError['reasonCode'],
) {
    assert.throws(operation, (error) => {
        assert.ok(error instanceof AdvancedSowingPlanBoundaryError);
        assert.equal(error.reasonCode, reasonCode);
        return true;
    });
}

describe('Advanced Sowing untrusted request parsing', () => {
    it('accepts only the small versioned selection request', () => {
        assert.deepEqual(
            parseUntrustedAdvancedSowingSelectionRequestV1(selectionRequest),
            selectionRequest,
        );
        for (const invalid of [
            { ...selectionRequest, selectedDistanceCm: 0 },
            { ...selectionRequest, selectedDistanceCm: Number.NaN },
            { ...selectionRequest, version: 2 },
            { ...selectionRequest, plan: {} },
        ]) {
            expectBoundaryReason(
                () => parseUntrustedAdvancedSowingSelectionRequestV1(invalid),
                'invalid_request',
            );
        }
    });

    it('labels structural envelope parsing as untrusted', () => {
        const { authorization } = authorize();
        assert.ok(authorization);
        assert.deepEqual(
            parseUntrustedAdvancedSowingCartAuthorizationV1(authorization),
            authorization,
        );
        expectBoundaryReason(
            () =>
                parseUntrustedAdvancedSowingCartAuthorizationV1({
                    ...authorization,
                    kind: 'client-plan',
                }),
            'invalid_authorization',
        );
    });
});

describe('Advanced Sowing catalogue range parsing', () => {
    it('reads only configurable catalogue ranges', () => {
        assert.deepEqual(
            readAdvancedSowingCatalogueDistanceRange({
                seedingDistance: 30,
                seedingDistanceMax: 60,
                seedingDistanceMin: 15,
            }),
            distanceRange,
        );
        expectBoundaryReason(
            () =>
                readAdvancedSowingCatalogueDistanceRange({
                    seedingDistance: 30,
                }),
            'catalogue_mismatch',
        );
        expectBoundaryReason(
            () =>
                readAdvancedSowingCatalogueDistanceRange({
                    seedingDistance: 30,
                    seedingDistanceMax: '60',
                }),
            'catalogue_mismatch',
        );
    });
});

describe('Advanced Sowing supported cart geometry', () => {
    it('uses canonical 3x6 geometry independently of sparse stored field rows', () => {
        assert.deepEqual(buildAdvancedSowingSupportedCartTarget(0), {
            bedFieldCount: 18,
            positionIndex: 0,
        });
        assert.deepEqual(buildAdvancedSowingSupportedCartTarget(17), {
            bedFieldCount: 18,
            positionIndex: 17,
        });
        for (const positionIndex of [-1, 18, 1.5, Number.NaN]) {
            expectBoundaryReason(
                () => buildAdvancedSowingSupportedCartTarget(positionIndex),
                'target_mismatch',
            );
        }
    });
});

describe('authorizeAdvancedSowingCartSelection', () => {
    it('returns a canonical server-only 2x2 envelope separately from client data', () => {
        const result = authorize();
        assert.ok(result.authorization);
        assert.equal(
            result.authorization.kind,
            advancedSowingCartAuthorizationKind,
        );
        assert.deepEqual(
            result.authorization.plan.occupiedPositionIndices,
            [11, 10, 8, 7],
        );
        assert.equal(result.authorization.plan.fieldSpanRows, 2);
        assert.equal(result.authorization.plan.fieldSpanColumns, 2);
        assert.equal(result.authorization.plan.plantCount, 1);
        assert.deepEqual(result.additionalData, {
            scheduledDate: '2026-09-01T00:00:00.000Z',
            sowingLocation: 'greenhouse',
        });
        assert.equal(
            Object.hasOwn(
                result.additionalData,
                advancedSowingCartAuthorizationKey,
            ),
            false,
        );
    });

    it('distinguishes spacing and footprint validation failures', () => {
        expectBoundaryReason(
            () =>
                authorize({
                    selectionRequest: {
                        ...selectionRequest,
                        selectedDistanceCm: 61,
                    },
                }),
            'spacing_out_of_range',
        );
        expectBoundaryReason(
            () => authorize({ target: { ...target, positionIndex: 0 } }),
            'footprint_out_of_bounds',
        );
    });

    it('rejects a catalogue range whose endpoints cannot fit the supported bed', () => {
        expectBoundaryReason(
            () =>
                authorize({
                    catalogueDistanceRange: {
                        maxDistanceCm: 95,
                        minDistanceCm: 15,
                        optimalDistanceCm: 30,
                    },
                    selectionRequest: {
                        ...selectionRequest,
                        selectedDistanceCm: 30,
                    },
                }),
            'catalogue_mismatch',
        );
    });

    it('rejects raw or forged authorization data in client additionalData', () => {
        const { authorization } = authorize();
        for (const clientAdditionalData of [
            { advancedSowing: authorization?.plan },
            { [advancedSowingCartAuthorizationKey]: authorization },
            JSON.stringify({
                [advancedSowingCartAuthorizationKey]: authorization,
            }),
        ]) {
            expectBoundaryReason(
                () => authorize({ clientAdditionalData }),
                'reserved_additional_data',
            );
        }
    });

    it('provides a write-boundary reserved-key audit without changing malformed legacy handling', () => {
        assert.doesNotThrow(() =>
            assertNoReservedAdvancedSowingAdditionalData(
                '{"scheduledDate":"2026-09-01T00:00:00.000Z"}',
            ),
        );
        assert.doesNotThrow(() =>
            assertNoReservedAdvancedSowingAdditionalData('{legacy-json'),
        );
        expectBoundaryReason(
            () =>
                assertNoReservedAdvancedSowingAdditionalData(
                    '{"advancedSowing":{"version":1}}',
                ),
            'reserved_additional_data',
        );
        expectBoundaryReason(
            () =>
                assertNoReservedAdvancedSowingAdditionalData(
                    '{"advancedSowingAuthorization":{"version":1}}',
                ),
            'reserved_additional_data',
        );
    });

    it('preserves legacy additionalData without creating an envelope', () => {
        assert.deepEqual(
            authorize({
                clientAdditionalData: JSON.stringify({
                    scheduledDate: '2026-09-01T00:00:00.000Z',
                }),
                selectionRequest: null,
            }),
            {
                additionalData: {
                    scheduledDate: '2026-09-01T00:00:00.000Z',
                },
                authorization: null,
            },
        );
    });
});

describe('Advanced Sowing checkout snapshot boundaries', () => {
    it('rejects catalogue drift before payment opens', () => {
        const { authorization } = authorize();
        expectBoundaryReason(
            () =>
                validateAdvancedSowingCartAuthorizationBeforeCheckout({
                    catalogueDistanceRange: {
                        maxDistanceCm: 45,
                        minDistanceCm: 20,
                        optimalDistanceCm: 30,
                    },
                    persistedAuthorization: authorization,
                    target,
                }),
            'catalogue_mismatch',
        );
    });

    it('revalidates authorization before payment and preserves the paid snapshot', () => {
        const { authorization } = authorize();
        assert.deepEqual(
            validateAdvancedSowingCartAuthorizationBeforeCheckout({
                catalogueDistanceRange: distanceRange,
                persistedAuthorization: authorization,
                target,
            }),
            authorization,
        );

        // A paid checkout snapshot has already crossed the authorization
        // boundary, so fulfillment remains independent of live catalogue data.
        assert.deepEqual(
            readAdvancedSowingPaidCheckoutSnapshot({
                checkoutSnapshotAuthorization: authorization,
                target,
            }),
            authorization,
        );
    });

    it('fails closed on tampered paid snapshots and target changes', () => {
        const { authorization } = authorize();
        assert.ok(authorization);
        expectBoundaryReason(
            () =>
                readAdvancedSowingPaidCheckoutSnapshot({
                    checkoutSnapshotAuthorization: {
                        ...authorization,
                        plan: {
                            ...authorization.plan,
                            occupiedPositionIndices: [11, 10, 8, 8],
                        },
                    },
                    target,
                }),
            'invalid_authorization',
        );
        expectBoundaryReason(
            () =>
                readAdvancedSowingPaidCheckoutSnapshot({
                    checkoutSnapshotAuthorization: authorization,
                    target: { ...target, positionIndex: 10 },
                }),
            'target_mismatch',
        );
    });

    it('keeps legacy paid fulfillment on its null compatibility path', () => {
        assert.equal(
            readAdvancedSowingPaidCheckoutSnapshot({
                checkoutSnapshotAuthorization: null,
                target,
            }),
            null,
        );
    });
});
