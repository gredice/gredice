import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getOperationScheduleActionFailureMessage,
    OPERATION_SCHEDULE_CONFLICT_MESSAGE,
    OperationScheduleConflictError,
    runOperationScheduleAction,
} from './operationScheduleActionResult.ts';

test('operation schedule conflicts return a recoverable action result', async () => {
    const result = await runOperationScheduleAction(async () => {
        throw new OperationScheduleConflictError();
    });

    assert.deepEqual(result, {
        success: false,
        message: OPERATION_SCHEDULE_CONFLICT_MESSAGE,
    });
});

test('storage task conflicts return a recoverable action result', async () => {
    const conflict = new Error(
        'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
    );
    conflict.name = 'ScheduleTaskSubmissionError';
    Object.assign(conflict, { code: 'task_changed' });

    const result = await runOperationScheduleAction(async () => {
        throw conflict;
    });

    assert.deepEqual(result, {
        success: false,
        message: OPERATION_SCHEDULE_CONFLICT_MESSAGE,
    });
});

test('non-conflict storage errors still escape the action', async () => {
    const invalidStatus = new Error('Radnja nije u očekivanom stanju.');
    invalidStatus.name = 'ScheduleTaskSubmissionError';
    Object.assign(invalidStatus, { code: 'invalid_status' });

    await assert.rejects(
        runOperationScheduleAction(async () => {
            throw invalidStatus;
        }),
        (error) => error === invalidStatus,
    );
});

test('unexpected operation schedule errors still escape the action', async () => {
    const unexpectedError = new Error(OPERATION_SCHEDULE_CONFLICT_MESSAGE);

    await assert.rejects(
        runOperationScheduleAction(async () => {
            throw unexpectedError;
        }),
        (error) => error === unexpectedError,
    );
});

test('successful operation schedule actions return a success result', async () => {
    assert.deepEqual(await runOperationScheduleAction(async () => {}), {
        success: true,
    });
});

test('failure messages are found in single and bulk action results', () => {
    const failure = {
        success: false,
        message: OPERATION_SCHEDULE_CONFLICT_MESSAGE,
    };

    assert.equal(
        getOperationScheduleActionFailureMessage(failure),
        OPERATION_SCHEDULE_CONFLICT_MESSAGE,
    );
    assert.equal(
        getOperationScheduleActionFailureMessage([
            { success: true },
            undefined,
            failure,
        ]),
        OPERATION_SCHEDULE_CONFLICT_MESSAGE,
    );
    assert.equal(
        getOperationScheduleActionFailureMessage(new Error('unexpected')),
        undefined,
    );
});
