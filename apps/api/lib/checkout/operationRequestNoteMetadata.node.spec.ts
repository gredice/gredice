import assert from 'node:assert/strict';
import test from 'node:test';
import {
    operationRequestNoteMetadata,
    readCheckoutProductAdditionalData,
} from './operationRequestNoteMetadata';

test('full length escaped operation notes survive Stripe metadata without exceeding its value limit', () => {
    const data = {
        scheduledDate: '2099-01-01T00:00:00.000Z',
        requestNote: '"\\č\n'.repeat(125).trim(),
        plantingTarget: { plantingId: 12 },
    };
    const metadata = {
        additionalData: JSON.stringify(data),
        ...operationRequestNoteMetadata(data),
    };
    assert.ok(Object.values(metadata).every((value) => value.length <= 500));
    assert.deepEqual(readCheckoutProductAdditionalData(metadata), data);
    assert.equal(data.requestNote.length, 499);
});

test('legacy checkout metadata and omitted notes remain compatible', () => {
    const data = { scheduledDate: '2099-01-01', requestNote: 'Legacy note' };
    assert.deepEqual(
        readCheckoutProductAdditionalData({
            additionalData: JSON.stringify(data),
        }),
        data,
    );
    assert.deepEqual(
        operationRequestNoteMetadata({ scheduledDate: '2099-01-01' }),
        {},
    );
    assert.deepEqual(readCheckoutProductAdditionalData(undefined), {});
});
