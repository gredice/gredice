import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationFinancialBreakdown } from './operationFinancialBreakdown';

test('groups task occurrences and totals money using cents', () => {
    const breakdown = buildOperationFinancialBreakdown([
        {
            key: 'operation:12',
            label: 'Zalijevanje',
            durationMinutes: 10,
            farmerCost: 0.1,
            userCost: 0.3,
        },
        {
            key: 'operation:12',
            label: 'Zalijevanje',
            durationMinutes: 10,
            farmerCost: 0.2,
            userCost: 0.4,
        },
        {
            key: 'sowing',
            label: 'Sijanje (direktno)',
            durationMinutes: 5,
            farmerCost: 0.5,
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
            userCost: 1.5,
            grossEarnings: 1,
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
            userCost: 0.7,
            grossEarnings: 0.4,
            missingFarmerPriceCount: 0,
            missingUserPriceCount: 0,
            incompleteEarningsCount: 0,
        },
    ]);
    assert.deepEqual(breakdown.totals, {
        taskCount: 3,
        totalDurationMinutes: 25,
        farmerCost: 0.8,
        userCost: 2.2,
        grossEarnings: 1.4,
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
            userCost: 0,
        },
        {
            key: 'operation:8',
            label: 'Nepotpuna radnja',
            durationMinutes: 15,
            farmerCost: null,
            userCost: 2,
        },
        {
            key: 'operation:8',
            label: 'Nepotpuna radnja',
            durationMinutes: 15,
            farmerCost: 0.5,
            userCost: null,
        },
    ]);

    assert.deepEqual(breakdown.totals, {
        taskCount: 3,
        totalDurationMinutes: 30,
        farmerCost: 1.5,
        userCost: 2,
        grossEarnings: -1,
        missingFarmerPriceCount: 1,
        missingUserPriceCount: 1,
        incompleteEarningsCount: 2,
    });
});
