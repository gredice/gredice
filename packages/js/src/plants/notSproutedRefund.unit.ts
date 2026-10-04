import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isNotSproutedRefundEligible,
    notSproutedRefundConfirmation,
} from './notSproutedRefund';

test('not-sprouted refund requires 15 complete days from actual sowing', () => {
    const sowed = new Date('2026-09-01T10:00:00Z');
    assert.equal(
        isNotSproutedRefundEligible(sowed, '2026-09-16T09:59:59Z'),
        false,
    );
    assert.equal(
        isNotSproutedRefundEligible(sowed, '2026-09-16T10:00:00Z'),
        true,
    );
    assert.equal(
        isNotSproutedRefundEligible(sowed, '2026-09-17T10:00:00Z'),
        true,
    );
    assert.equal(
        isNotSproutedRefundEligible(undefined, '2026-09-20T10:00:00Z'),
        false,
    );
    assert.equal(
        isNotSproutedRefundEligible('invalid', '2026-09-20T10:00:00Z'),
        false,
    );
    assert.equal(
        isNotSproutedRefundEligible(sowed, '2026-08-31T10:00:00Z'),
        false,
    );
    assert.match(
        notSproutedRefundConfirmation(sowed, '2026-09-16T10:00:00Z'),
        /Puni plaćeni iznos/,
    );
    assert.match(
        notSproutedRefundConfirmation(sowed, '2026-09-16T09:59:59Z'),
        /neće vratiti suncokrete/,
    );
});
