import assert from 'node:assert/strict';
import test from 'node:test';
import { customerDeliveryRequest } from './customerDeliveryRequest';

test('customer delivery request excludes driver-only notes and preserves the safe receipt', () => {
    const privateNote = 'PRIVATE DRIVER NOTE';
    const request = customerDeliveryRequest({
        id: 'customer-request-4144',
        accountId: 'customer-account-4144',
        deliveryNotes: privateNote,
        customerHandoffReceipt: {
            fulfilledAt: new Date('2026-07-16T10:30:00.000Z'),
            verification: 'verified' as const,
        },
    });

    assert.deepEqual(request, {
        id: 'customer-request-4144',
        accountId: 'customer-account-4144',
        customerHandoffReceipt: {
            fulfilledAt: new Date('2026-07-16T10:30:00.000Z'),
            verification: 'verified',
        },
    });
    assert.equal(JSON.stringify(request).includes(privateNote), false);
    assert.equal('deliveryNotes' in request, false);
});
