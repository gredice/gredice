import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getGardenStructureSunflowerHistoryDescription } from './gardenStructureSunflowerReason';

describe('getGardenStructureSunflowerHistoryDescription', () => {
    it('labels construction, expansion, shrink refunds, and demolition refunds', () => {
        assert.deepEqual(
            getGardenStructureSunflowerHistoryDescription(
                'gardenStructure:42:structure-1:create:operation-1:debit',
            ),
            { icon: 'construction', label: 'Izgradnja građevine' },
        );
        assert.deepEqual(
            getGardenStructureSunflowerHistoryDescription(
                'gardenStructure:42:structure-1:resize:operation-2:debit',
            ),
            { icon: 'resize', label: 'Proširenje građevine' },
        );
        assert.deepEqual(
            getGardenStructureSunflowerHistoryDescription(
                'gardenStructure:42:structure-1:resize:operation-3:refund',
            ),
            { icon: 'refund', label: 'Povrat za smanjenje građevine' },
        );
        assert.deepEqual(
            getGardenStructureSunflowerHistoryDescription(
                'gardenStructure:42:structure-1:delete:operation-4:refund',
            ),
            { icon: 'refund', label: 'Povrat za uklanjanje građevine' },
        );
    });

    it('rejects malformed and unsupported reasons', () => {
        assert.equal(
            getGardenStructureSunflowerHistoryDescription(
                'gardenStructure:42:structure-1:placement:operation-1:debit',
            ),
            null,
        );
        assert.equal(
            getGardenStructureSunflowerHistoryDescription(
                'gardenStructure:42:structure:with:colon:create:operation-1:debit',
            ),
            null,
        );
        assert.equal(
            getGardenStructureSunflowerHistoryDescription('daily:2026-08-30'),
            null,
        );
    });
});
