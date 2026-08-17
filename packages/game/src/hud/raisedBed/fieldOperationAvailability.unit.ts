import assert from 'node:assert/strict';
import test from 'node:test';
import { isFieldOperationAvailable } from './fieldOperationAvailability';

test('allows plant operations linked to an occupied field', () => {
    assert.equal(
        isFieldOperationAvailable(
            {
                attributes: {
                    application: 'plant',
                    appliesToAllTargets: false,
                },
            },
            true,
        ),
        true,
    );
});

test('only allows all-target plant operations on an empty field', () => {
    assert.equal(
        isFieldOperationAvailable(
            {
                attributes: {
                    application: 'plant',
                    appliesToAllTargets: true,
                },
            },
            false,
        ),
        true,
    );
    assert.equal(
        isFieldOperationAvailable(
            {
                attributes: {
                    application: 'plant',
                    appliesToAllTargets: false,
                },
            },
            false,
        ),
        false,
    );
});

test('rejects raised-bed operations for field targets', () => {
    assert.equal(
        isFieldOperationAvailable(
            {
                attributes: {
                    application: 'raisedBedFull',
                    appliesToAllTargets: true,
                },
            },
            false,
        ),
        false,
    );
});
