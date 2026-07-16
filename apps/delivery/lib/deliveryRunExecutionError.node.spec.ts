import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DeliveryRunExecutionError,
    DeliveryRunExecutionErrorCodes,
} from '@gredice/storage';
import {
    deliveryRunExecutionErrorDetails,
    deliveryRunExecutionErrorStatus,
} from './deliveryRunExecutionError';

test('maps typed stop operation failures to conflict responses', () => {
    for (const code of [
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_CONFLICT,
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_INVALID,
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_STATE_CONFLICT,
    ]) {
        const error = new DeliveryRunExecutionError(code, 'internal detail');
        const details = deliveryRunExecutionErrorDetails(error);

        assert.equal(details?.code, code);
        assert.ok(details?.message);
        assert.equal(deliveryRunExecutionErrorStatus(error), 409);
    }
});

test('maps a missing completion override to actionable recovery copy', () => {
    const error = new DeliveryRunExecutionError(
        DeliveryRunExecutionErrorCodes.COMPLETION_OVERRIDE_REQUIRED,
        'internal detail',
    );

    assert.deepEqual(deliveryRunExecutionErrorDetails(error), {
        code: 'completion-override-required',
        message:
            'Za dostavu bez potvrđenog dolaska ili pregleda uroda odaberi razlog i ponovno potvrdi dostavu.',
    });
    assert.equal(deliveryRunExecutionErrorStatus(error), 409);
});

test('maps unknown failures to internal server errors without details', () => {
    const error = new Error('database unavailable');

    assert.equal(deliveryRunExecutionErrorDetails(error), null);
    assert.equal(deliveryRunExecutionErrorStatus(error), 500);
});
