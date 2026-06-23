import assert from 'node:assert/strict';
import test from 'node:test';
import {
    operationApplicationScope,
    operationDefinitionMatchesTargetScope,
    operationTargetScope,
} from './operationScope';

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
