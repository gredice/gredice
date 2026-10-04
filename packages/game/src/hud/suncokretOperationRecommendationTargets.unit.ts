import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOperationRecommendationTargets } from './suncokretOperationRecommendationTargets';

const recommendation = {
    kind: 'operation' as const,
    operationId: 569,
    gardenId: 1,
    raisedBedId: 11,
};

const garden = {
    id: 1,
    raisedBeds: [
        {
            id: 11,
            status: 'active',
            fields: [
                {
                    active: true,
                    plantSortId: 101,
                    positionIndex: 1,
                },
                {
                    active: true,
                    plantSortId: 102,
                    positionIndex: 2,
                },
            ],
        },
    ],
};

const operation = {
    attributes: {
        application: 'plant',
        appliesToAllTargets: false,
    },
    information: { name: 'applyTomatoResiliencePreparation' },
};

test('resolves a missing plant-operation target from linked occupied fields', () => {
    const targets = resolveOperationRecommendationTargets({
        garden,
        operation,
        plantSorts: [
            {
                id: 101,
                information: {
                    plant: {
                        information: {
                            operations: [
                                {
                                    information: {
                                        name: operation.information.name,
                                    },
                                },
                            ],
                        },
                    },
                },
            },
            {
                id: 102,
                information: {
                    plant: { information: { operations: [] } },
                },
            },
        ],
        recommendation,
    });

    assert.deepEqual(targets, [{ ...recommendation, positionIndex: 1 }]);
});

test('resolves globally applicable operations for unpublished planted sorts', () => {
    const targets = resolveOperationRecommendationTargets({
        garden: {
            ...garden,
            raisedBeds: [
                {
                    ...garden.raisedBeds[0],
                    fields: [
                        {
                            active: true,
                            plantSortId: 999,
                            positionIndex: 4,
                        },
                    ],
                },
            ],
        },
        operation: {
            ...operation,
            attributes: {
                ...operation.attributes,
                appliesToAllTargets: true,
            },
        },
        plantSorts: [],
        recommendation,
    });

    assert.deepEqual(targets, [{ ...recommendation, positionIndex: 4 }]);
});
