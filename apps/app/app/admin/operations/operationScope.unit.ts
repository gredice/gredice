import assert from 'node:assert/strict';
import test from 'node:test';
import {
    activeSelectedPlantingFieldIds,
    isAdvancedSowingPlantOperationTargetBlocked,
    operationApplicationScope,
    operationDefinitionMatchesTargetScope,
    operationTargetScope,
} from './operationScope';

test('activeSelectedPlantingFieldIds covers selected-only and co-planted fields', () => {
    const selectedOnly = activeSelectedPlantingFieldIds([
        {
            configurationSource: 'selected',
            isActive: true,
            memberships: [{ raisedBedFieldId: 10 }],
        },
    ]);
    assert.deepEqual([...selectedOnly], [10]);

    const coPlanted = activeSelectedPlantingFieldIds([
        {
            configurationSource: 'legacy',
            isActive: true,
            memberships: [{ raisedBedFieldId: 20 }],
        },
        {
            configurationSource: 'selected',
            isActive: true,
            memberships: [{ raisedBedFieldId: 20 }],
        },
    ]);
    assert.deepEqual([...coPlanted], [20]);
});

test('activeSelectedPlantingFieldIds ignores inactive, deleted, and legacy memberships', () => {
    const fieldIds = activeSelectedPlantingFieldIds([
        {
            configurationSource: 'legacy',
            isActive: true,
            memberships: [{ raisedBedFieldId: 1 }],
        },
        {
            configurationSource: 'selected',
            isActive: false,
            memberships: [{ raisedBedFieldId: 2 }],
        },
        {
            configurationSource: 'selected',
            isActive: true,
            isDeleted: true,
            memberships: [{ raisedBedFieldId: 3 }],
        },
        {
            configurationSource: 'selected',
            isActive: true,
            memberships: [
                { raisedBedFieldId: 4, isDeleted: true },
                { raisedBedFieldId: 5 },
            ],
        },
    ]);
    assert.deepEqual([...fieldIds], [5]);
});

test('only plant-scoped operations are disabled on selected planting fields', () => {
    assert.equal(
        isAdvancedSowingPlantOperationTargetBlocked({
            application: 'plant',
            hasActiveSelectedPlanting: true,
        }),
        true,
    );
    for (const application of [
        'raisedBedFull',
        'raisedBed1m',
        'garden',
        'farm',
    ]) {
        assert.equal(
            isAdvancedSowingPlantOperationTargetBlocked({
                application,
                hasActiveSelectedPlanting: true,
            }),
            false,
        );
    }
    assert.equal(
        isAdvancedSowingPlantOperationTargetBlocked({
            application: 'plant',
            hasActiveSelectedPlanting: false,
        }),
        false,
    );
});

test('operationTargetScope infers target from the stored operation location', () => {
    assert.strictEqual(operationTargetScope({ farmId: 1 }), 'farm');
    assert.strictEqual(
        operationTargetScope({ farmId: 1, gardenId: 2 }),
        'garden',
    );
    assert.strictEqual(
        operationTargetScope({ gardenId: 2, raisedBedId: 3 }),
        'raisedBed',
    );
    assert.strictEqual(
        operationTargetScope({
            gardenId: 2,
            raisedBedId: 3,
            raisedBedFieldId: 4,
        }),
        'plant',
    );
});

test('operationApplicationScope follows create modal target selection modes', () => {
    assert.strictEqual(operationApplicationScope('farm'), 'farm');
    assert.strictEqual(operationApplicationScope('garden'), 'garden');
    assert.strictEqual(operationApplicationScope('plant'), 'plant');
    assert.strictEqual(operationApplicationScope('raisedBedFull'), 'raisedBed');
    assert.strictEqual(operationApplicationScope('raisedBed1m'), 'raisedBed');
    assert.strictEqual(operationApplicationScope(undefined), undefined);
});

test('operationDefinitionMatchesTargetScope blocks cross-scope switches', () => {
    const raisedBedOperation = { gardenId: 2, raisedBedId: 3 };
    assert.equal(
        operationDefinitionMatchesTargetScope(raisedBedOperation, {
            attributes: { application: 'raisedBedFull' },
        }),
        true,
    );
    assert.equal(
        operationDefinitionMatchesTargetScope(raisedBedOperation, {
            attributes: { application: 'plant' },
        }),
        false,
    );
    assert.equal(
        operationDefinitionMatchesTargetScope(raisedBedOperation, {
            attributes: { application: 'farm' },
        }),
        false,
    );

    const fieldOperation = {
        gardenId: 2,
        raisedBedId: 3,
        raisedBedFieldId: 4,
    };
    assert.equal(
        operationDefinitionMatchesTargetScope(fieldOperation, {
            attributes: { application: 'plant' },
        }),
        true,
    );
    assert.equal(
        operationDefinitionMatchesTargetScope(fieldOperation, {
            attributes: { application: 'raisedBed1m' },
        }),
        false,
    );
});
