import assert from 'node:assert/strict';
import test from 'node:test';
import { isOperationApplicableToPlant } from '@gredice/js/operations';
import { isPlantTargetMetadataResolved } from './shared/plantTargetMetadata';

function operation({
    name,
    application = 'plant',
    appliesToAllTargets,
}: {
    name: string;
    application?: string;
    appliesToAllTargets?: boolean;
}) {
    return {
        attributes: {
            application,
            appliesToAllTargets,
        },
        information: {
            name,
        },
    };
}

test('accepts a plant operation linked to the selected plant', () => {
    assert.equal(
        isOperationApplicableToPlant(
            operation({ name: 'linkedOperation' }),
            new Set(['linkedOperation']),
        ),
        true,
    );
});

test('accepts an all-target plant operation without a plant link', () => {
    assert.equal(
        isOperationApplicableToPlant(
            operation({
                name: 'globalPlantOperation',
                appliesToAllTargets: true,
            }),
            new Set(),
        ),
        true,
    );
});

test('rejects an unlinked plant operation when all-target applicability is absent or false', () => {
    const linkedOperationNames = new Set<string>();

    assert.equal(
        isOperationApplicableToPlant(
            operation({ name: 'defaultOperation' }),
            linkedOperationNames,
        ),
        false,
    );
    assert.equal(
        isOperationApplicableToPlant(
            operation({
                name: 'explicitlyScopedOperation',
                appliesToAllTargets: false,
            }),
            linkedOperationNames,
        ),
        false,
    );
});

test('rejects non-plant operations even when linked or marked for all targets', () => {
    assert.equal(
        isOperationApplicableToPlant(
            operation({
                name: 'raisedBedOperation',
                application: 'raisedBedFull',
                appliesToAllTargets: true,
            }),
            new Set(['raisedBedOperation']),
        ),
        false,
    );
});

test('keeps plant-target rows pending until plant metadata resolves', () => {
    assert.equal(isPlantTargetMetadataResolved(101, undefined), false);
    assert.equal(isPlantTargetMetadataResolved(101, null), true);
    assert.equal(isPlantTargetMetadataResolved(101, { id: 101 }), true);
});

test('does not wait for plant metadata in a non-plant operations list', () => {
    assert.equal(isPlantTargetMetadataResolved(undefined, undefined), true);
});

test('suppresses all-target recommendations until plant metadata resolves', () => {
    const globalOperation = operation({
        name: 'globalPlantOperation',
        appliesToAllTargets: true,
    });
    const linkedOperationNames = new Set<string>();

    assert.equal(
        isPlantTargetMetadataResolved(101, undefined) &&
            isOperationApplicableToPlant(globalOperation, linkedOperationNames),
        false,
    );
    assert.equal(
        isPlantTargetMetadataResolved(101, { id: 101 }) &&
            isOperationApplicableToPlant(globalOperation, linkedOperationNames),
        true,
    );
});
