import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type EntityCompletenessAttributeDefinition,
    type EntityCompletenessEntity,
    filterEntitiesByCompletionAndState,
    getEntityCompleteness,
    getIncompleteEntityCountsByState,
} from '@gredice/storage/entityCompleteness';

const requiredLabelDefinition: EntityCompletenessAttributeDefinition = {
    id: 1,
    category: 'information',
    label: 'Naziv',
    required: true,
    defaultValue: null,
};

const requiredDefaultDefinition: EntityCompletenessAttributeDefinition = {
    id: 2,
    category: 'information',
    label: 'Vrsta',
    required: true,
    defaultValue: 'standard',
};

const optionalDefinition: EntityCompletenessAttributeDefinition = {
    id: 3,
    category: 'metadata',
    label: 'Napomena',
    required: false,
    defaultValue: null,
};

test('getEntityCompleteness treats entities without required definitions as complete', () => {
    const entity: EntityCompletenessEntity = {
        attributes: [],
    };

    assert.deepStrictEqual(
        getEntityCompleteness(entity, [optionalDefinition]),
        {
            requiredCount: 0,
            completedRequiredCount: 0,
            missingRequiredDefinitions: [],
            progress: 100,
            isComplete: true,
        },
    );
});

test('getEntityCompleteness reports missing required definitions and preserves default value behavior', () => {
    const entity: EntityCompletenessEntity = {
        attributes: [
            {
                attributeDefinitionId: requiredLabelDefinition.id,
                value: '',
            },
        ],
    };

    const completeness = getEntityCompleteness(entity, [
        requiredLabelDefinition,
        requiredDefaultDefinition,
        optionalDefinition,
    ]);

    assert.strictEqual(completeness.requiredCount, 2);
    assert.strictEqual(completeness.completedRequiredCount, 1);
    assert.strictEqual(completeness.progress, 50);
    assert.strictEqual(completeness.isComplete, false);
    assert.deepStrictEqual(completeness.missingRequiredDefinitions, [
        requiredLabelDefinition,
    ]);
});

test('filterEntitiesByCompletionAndState combines completion and publish state filters', () => {
    const completeDraft: EntityCompletenessEntity = {
        state: 'draft',
        attributes: [
            {
                attributeDefinitionId: requiredLabelDefinition.id,
                value: 'Mrkva',
            },
        ],
    };
    const incompleteDraft: EntityCompletenessEntity = {
        state: 'draft',
        attributes: [],
    };
    const incompletePublished: EntityCompletenessEntity = {
        state: 'published',
        attributes: [],
    };
    const entities = [completeDraft, incompleteDraft, incompletePublished];
    const definitions = [requiredLabelDefinition];

    assert.deepStrictEqual(
        filterEntitiesByCompletionAndState(entities, definitions, {
            completion: 'incomplete',
            state: 'draft',
        }),
        [incompleteDraft],
    );
    assert.deepStrictEqual(
        filterEntitiesByCompletionAndState(entities, definitions, {
            completion: 'complete',
            state: '',
        }),
        [completeDraft],
    );
    assert.deepStrictEqual(
        filterEntitiesByCompletionAndState(entities, definitions, {
            completion: '',
            state: 'published',
        }),
        [incompletePublished],
    );
});

test('getIncompleteEntityCountsByState returns draft and published incomplete counts', () => {
    const entities: EntityCompletenessEntity[] = [
        {
            state: 'draft',
            attributes: [],
        },
        {
            state: 'published',
            attributes: [],
        },
        {
            state: 'published',
            attributes: [
                {
                    attributeDefinitionId: requiredLabelDefinition.id,
                    value: 'Tikvica',
                },
            ],
        },
    ];

    assert.deepStrictEqual(
        getIncompleteEntityCountsByState(entities, [requiredLabelDefinition]),
        {
            draft: 1,
            published: 1,
        },
    );
});
