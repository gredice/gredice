import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildOperationFinancialBreakdown,
    resolveOperationUserCost,
} from './operationFinancialBreakdown';

test('only customer-requested operations include the customer price', () => {
    const checkoutProvenanceRecordedFrom = new Date('2026-08-03T16:16:01.000Z');
    assert.equal(
        resolveOperationUserCost({
            checkoutProvenanceRecordedFrom,
            hasCheckoutProvenance: true,
            isInternal: false,
            operationCreatedAt: new Date('2026-08-04T00:00:00.000Z'),
            userPrice: 1.5,
        }),
        1.5,
    );
    assert.equal(
        resolveOperationUserCost({
            checkoutProvenanceRecordedFrom,
            hasCheckoutProvenance: false,
            isInternal: false,
            operationCreatedAt: new Date('2026-08-04T00:00:00.000Z'),
            userPrice: 1.5,
        }),
        0,
    );
    assert.equal(
        resolveOperationUserCost({
            checkoutProvenanceRecordedFrom,
            hasCheckoutProvenance: true,
            isInternal: true,
            operationCreatedAt: new Date('2026-08-04T00:00:00.000Z'),
            userPrice: 1.5,
        }),
        0,
    );
    assert.equal(
        resolveOperationUserCost({
            checkoutProvenanceRecordedFrom,
            hasCheckoutProvenance: true,
            isInternal: false,
            operationCreatedAt: new Date('2026-08-04T00:00:00.000Z'),
            userPrice: null,
        }),
        null,
    );
});

test('preserves customer prices before checkout provenance was recorded', () => {
    const input = {
        hasCheckoutProvenance: false,
        isInternal: false,
        operationCreatedAt: new Date('2026-08-02T00:00:00.000Z'),
        userPrice: 1.5,
    };

    assert.equal(
        resolveOperationUserCost({
            ...input,
            checkoutProvenanceRecordedFrom: new Date(
                '2026-08-03T16:16:01.000Z',
            ),
        }),
        1.5,
    );
});

test('groups task occurrences and totals money using cents', () => {
    const breakdown = buildOperationFinancialBreakdown([
        {
            key: 'operation:12',
            label: 'Zalijevanje',
            durationMinutes: 10,
            farmerCost: 0.1,
            materialCost: 0.05,
            userCost: 0.3,
        },
        {
            key: 'operation:12',
            label: 'Zalijevanje',
            durationMinutes: 10,
            farmerCost: 0.2,
            materialCost: 0.1,
            userCost: 0.4,
        },
        {
            key: 'sowing',
            label: 'Sijanje (direktno)',
            durationMinutes: 5,
            farmerCost: 0.5,
            materialCost: 0,
            userCost: 1.5,
        },
    ]);

    assert.deepEqual(breakdown.rows, [
        {
            key: 'sowing',
            label: 'Sijanje (direktno)',
            taskCount: 1,
            totalDurationMinutes: 5,
            farmerCost: 0.5,
            materialCost: 0,
            userCost: 1.5,
            estimatedEarnings: 1,
            missingFarmerPriceCount: 0,
            missingUserPriceCount: 0,
            incompleteEarningsCount: 0,
        },
        {
            key: 'operation:12',
            label: 'Zalijevanje',
            taskCount: 2,
            totalDurationMinutes: 20,
            farmerCost: 0.3,
            materialCost: 0.15,
            userCost: 0.7,
            estimatedEarnings: 0.25,
            missingFarmerPriceCount: 0,
            missingUserPriceCount: 0,
            incompleteEarningsCount: 0,
        },
    ]);
    assert.deepEqual(breakdown.totals, {
        taskCount: 3,
        totalDurationMinutes: 25,
        farmerCost: 0.8,
        materialCost: 0.15,
        userCost: 2.2,
        estimatedEarnings: 1.25,
        missingFarmerPriceCount: 0,
        missingUserPriceCount: 0,
        incompleteEarningsCount: 0,
    });
});

test('reports incomplete prices without treating them as known earnings', () => {
    const breakdown = buildOperationFinancialBreakdown([
        {
            key: 'operation:7',
            label: 'Interna radnja',
            durationMinutes: -5,
            farmerCost: 1,
            materialCost: 0.25,
            userCost: 0,
        },
        {
            key: 'operation:8',
            label: 'Nepotpuna radnja',
            durationMinutes: 15,
            farmerCost: null,
            materialCost: 0.5,
            userCost: 2,
        },
        {
            key: 'operation:8',
            label: 'Nepotpuna radnja',
            durationMinutes: 15,
            farmerCost: 0.5,
            materialCost: 0,
            userCost: null,
        },
    ]);

    assert.deepEqual(breakdown.totals, {
        taskCount: 3,
        totalDurationMinutes: 30,
        farmerCost: 1.5,
        materialCost: 0.75,
        userCost: 2,
        estimatedEarnings: -1.25,
        missingFarmerPriceCount: 1,
        missingUserPriceCount: 1,
        incompleteEarningsCount: 2,
    });
});
