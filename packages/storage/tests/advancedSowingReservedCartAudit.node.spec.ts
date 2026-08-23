import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advancedSowingReservedCartAuditPasses,
    auditAdvancedSowingReservedCartAdditionalData,
} from '../scripts/lib/advancedSowingReservedCartAudit';

describe('Advanced Sowing reserved open-cart audit', () => {
    it('reports bounded counts without returning cart data', () => {
        const audit = auditAdvancedSowingReservedCartAdditionalData([
            { additionalData: null },
            { additionalData: '{"scheduledDate":"2026-09-01"}' },
            { additionalData: '{"advancedSowing":{"version":1}}' },
            {
                additionalData:
                    '{"advancedSowing":{},"advancedSowingAuthorization":{}}',
            },
        ]);

        assert.deepEqual(audit, {
            clearItemCount: 2,
            reservedAdditionalDataItemCount: 2,
            reservedKeyCounts: {
                advancedSowing: 2,
                advancedSowingAuthorization: 1,
            },
            scannedItemCount: 4,
            unparseableAdditionalDataItemCount: 0,
        });
        assert.equal('items' in audit, false);
        assert.equal(advancedSowingReservedCartAuditPasses(audit), false);
    });

    it('passes only parseable object data without reserved keys', () => {
        const audit = auditAdvancedSowingReservedCartAdditionalData([
            { additionalData: '' },
            { additionalData: '{}' },
        ]);

        assert.equal(advancedSowingReservedCartAuditPasses(audit), true);
    });

    it('fails closed on malformed or non-object additional data', () => {
        const audit = auditAdvancedSowingReservedCartAdditionalData([
            { additionalData: '{' },
            { additionalData: '[]' },
        ]);

        assert.equal(audit.unparseableAdditionalDataItemCount, 2);
        assert.equal(advancedSowingReservedCartAuditPasses(audit), false);
    });
});
