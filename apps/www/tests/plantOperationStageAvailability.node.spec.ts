import assert from 'node:assert/strict';
import test from 'node:test';
import { getApplicablePlantOperationStageNames } from '../app/biljke/[alias]/plantOperationStageAvailability.ts';

function operation({
    application = 'plant',
    appliesToAllTargets = false,
    internal = false,
    name,
    stage = 'growth',
}: {
    application?: string;
    appliesToAllTargets?: boolean;
    internal?: boolean;
    name: string;
    stage?: string;
}) {
    return {
        attributes: {
            application,
            appliesToAllTargets,
            internal,
            stage: {
                information: {
                    name: stage,
                },
            },
        },
        information: {
            name,
        },
    };
}

test('includes the stage of a plant operation applicable to all plants', () => {
    const stageNames = getApplicablePlantOperationStageNames(
        [
            operation({
                appliesToAllTargets: true,
                name: 'plantPhoto',
                stage: 'maintenance',
            }),
        ],
        [],
    );

    assert.deepEqual([...stageNames], ['maintenance']);
});

test('does not include an unlinked plant operation when the flag is false', () => {
    const stageNames = getApplicablePlantOperationStageNames(
        [operation({ name: 'plantPhoto' })],
        [],
    );

    assert.deepEqual([...stageNames], []);
});

test('still includes stages from explicitly linked plant operations', () => {
    const linkedOperation = operation({ name: 'plantPhoto' });
    const stageNames = getApplicablePlantOperationStageNames(
        [],
        [linkedOperation],
    );

    assert.deepEqual([...stageNames], ['growth']);
});

test('does not expose stages from internal or non-plant operations', () => {
    const stageNames = getApplicablePlantOperationStageNames(
        [
            operation({
                appliesToAllTargets: true,
                internal: true,
                name: 'internalPlantOperation',
            }),
            operation({
                application: 'raisedBedFull',
                appliesToAllTargets: true,
                name: 'raisedBedOperation',
            }),
        ],
        [],
    );

    assert.deepEqual([...stageNames], []);
});
