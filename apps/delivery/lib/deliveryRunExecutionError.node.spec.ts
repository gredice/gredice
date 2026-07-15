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

test('maps unknown failures to internal server errors without details', () => {
    const error = new Error('database unavailable');

    assert.equal(deliveryRunExecutionErrorDetails(error), null);
    assert.equal(deliveryRunExecutionErrorStatus(error), 500);
});
