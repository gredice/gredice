import assert from 'node:assert/strict';
import test from 'node:test';
import {
    allocateGeneratedPlantDetailBudget,
    type GeneratedPlantDetailBudgetRequest,
    HIGH_GENERATED_PLANT_DETAIL_INSTANCE_BUDGET,
    isGeneratedPlantDetailBudgetActive,
    resolveLegacyGeneratedPlantDetailBudget,
} from './generatedPlantDetailBudget';

function nearRequest(
    raisedBedId: number,
    overrides: Partial<GeneratedPlantDetailBudgetRequest> = {},
): GeneratedPlantDetailBudgetRequest {
    return {
        instanceCount: HIGH_GENERATED_PLANT_DETAIL_INSTANCE_BUDGET,
        isInteracting: false,
        isSelected: false,
        projectedBenefit: 1,
        raisedBedId,
        requestedLod: 'near',
        wasAdmitted: false,
        ...overrides,
    };
}

function admittedRaisedBedIds(
    requests: readonly GeneratedPlantDetailBudgetRequest[],
) {
    return allocateGeneratedPlantDetailBudget(requests)
        .decisions.filter((decision) => decision.detailAdmitted)
        .map((decision) => decision.raisedBedId);
}

test('High admits one of three 179-instance raised beds atomically', () => {
    const allocation = allocateGeneratedPlantDetailBudget([
        nearRequest(1),
        nearRequest(2),
        nearRequest(3),
    ]);

    assert.deepEqual(
        admittedRaisedBedIds([nearRequest(1), nearRequest(2), nearRequest(3)]),
        [1],
    );
    assert.deepEqual(
        allocation.decisions.map((decision) => decision.resolvedLod),
        ['near', 'mid', 'mid'],
    );
    assert.deepEqual(allocation.stats, {
        admittedBedCount: 1,
        admittedInstanceCount: 179,
        demotedBedCount: 2,
        evictedBedCount: 0,
        instanceBudget: 179,
        overflowInstanceCount: 0,
        promotedBedCount: 1,
        releasedBedCount: 0,
        requestedBedCount: 3,
        requestedInstanceCount: 537,
        retainedBedCount: 0,
        usedBudgetInstanceCount: 179,
    });
});

test('selected raised-bed detail is pinned and reports explicit overflow', () => {
    const allocation = allocateGeneratedPlantDetailBudget([
        nearRequest(1, {
            instanceCount: 220,
            isSelected: true,
            projectedBenefit: 0,
        }),
        nearRequest(2, {
            instanceCount: 10,
            projectedBenefit: 100,
        }),
    ]);

    assert.deepEqual(
        admittedRaisedBedIds([
            nearRequest(1, {
                instanceCount: 220,
                isSelected: true,
                projectedBenefit: 0,
            }),
            nearRequest(2, {
                instanceCount: 10,
                projectedBenefit: 100,
            }),
        ]),
        [1],
    );
    assert.equal(allocation.stats.admittedInstanceCount, 220);
    assert.equal(allocation.stats.usedBudgetInstanceCount, 179);
    assert.equal(allocation.stats.overflowInstanceCount, 41);
});

test('offscreen, mid, and far beds do not consume the near-detail budget', () => {
    const allocation = allocateGeneratedPlantDetailBudget([
        nearRequest(1),
        nearRequest(2, {
            instanceCount: 1_000,
            requestedLod: 'far',
            wasAdmitted: true,
        }),
        nearRequest(3, {
            instanceCount: 1_000,
            requestedLod: 'mid',
        }),
    ]);

    assert.deepEqual(
        allocation.decisions.map((decision) => decision.resolvedLod),
        ['near', 'far', 'mid'],
    );
    assert.equal(allocation.stats.requestedBedCount, 1);
    assert.equal(allocation.stats.requestedInstanceCount, 179);
    assert.equal(allocation.stats.usedBudgetInstanceCount, 179);
    assert.equal(allocation.stats.releasedBedCount, 1);
});

test('interaction priority wins before projected benefit per instance', () => {
    const requests = [
        nearRequest(1, {
            isInteracting: true,
            projectedBenefit: 1,
        }),
        nearRequest(2, {
            projectedBenefit: 1_000,
        }),
    ];

    assert.deepEqual(admittedRaisedBedIds(requests), [1]);
});

test('incumbent hysteresis absorbs a small projected-score change', () => {
    const requests = [
        nearRequest(1, {
            projectedBenefit: 100,
            wasAdmitted: true,
        }),
        nearRequest(2, {
            projectedBenefit: 105,
        }),
    ];
    const allocation = allocateGeneratedPlantDetailBudget(requests);

    assert.deepEqual(admittedRaisedBedIds(requests), [1]);
    assert.equal(allocation.stats.retainedBedCount, 1);
    assert.equal(allocation.stats.promotedBedCount, 0);
});

test('stable raised-bed id breaks a complete ranking tie', () => {
    const requests = [nearRequest(9), nearRequest(4)];

    assert.deepEqual(admittedRaisedBedIds(requests), [4]);
});

test('an oversized bed is rejected whole while a later bed may fit', () => {
    const allocation = allocateGeneratedPlantDetailBudget([
        nearRequest(1, {
            instanceCount: 180,
            projectedBenefit: 18_000,
        }),
        nearRequest(2, {
            projectedBenefit: 1,
        }),
    ]);

    assert.deepEqual(
        allocation.decisions.map((decision) => ({
            detailAdmitted: decision.detailAdmitted,
            raisedBedId: decision.raisedBedId,
            resolvedLod: decision.resolvedLod,
        })),
        [
            {
                detailAdmitted: false,
                raisedBedId: 1,
                resolvedLod: 'mid',
            },
            {
                detailAdmitted: true,
                raisedBedId: 2,
                resolvedLod: 'near',
            },
        ],
    );
    assert.equal(allocation.stats.admittedInstanceCount, 179);
});

test('legacy admission requires the explicit profile query', () => {
    assert.equal(
        resolveLegacyGeneratedPlantDetailBudget('?foliageBudget=legacy'),
        true,
    );
    assert.equal(
        resolveLegacyGeneratedPlantDetailBudget('?foliageBudget=1'),
        false,
    );
    assert.equal(resolveLegacyGeneratedPlantDetailBudget(), false);
});

test('the global detail budget changes only the non-legacy High profile', () => {
    assert.equal(isGeneratedPlantDetailBudgetActive('high', false), true);
    assert.equal(isGeneratedPlantDetailBudgetActive('high', true), false);
    assert.equal(isGeneratedPlantDetailBudgetActive('medium', false), false);
    assert.equal(isGeneratedPlantDetailBudgetActive('low', false), false);
    assert.equal(
        isGeneratedPlantDetailBudgetActive('auto-constrained', false),
        false,
    );
    assert.equal(isGeneratedPlantDetailBudgetActive('custom', false), false);
});
