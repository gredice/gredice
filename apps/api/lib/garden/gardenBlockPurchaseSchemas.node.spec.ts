import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    gardenBlockPurchaseBodySchema,
    gardenBlockPurchaseParamSchema,
} from './gardenBlockPurchaseSchemas';

describe('garden block purchase route schemas', () => {
    it('accepts canonical positive PostgreSQL int32 garden IDs', () => {
        assert.deepEqual(
            gardenBlockPurchaseParamSchema.parse({ gardenId: '1' }),
            {
                gardenId: 1,
            },
        );
        assert.deepEqual(
            gardenBlockPurchaseParamSchema.parse({ gardenId: '2147483647' }),
            { gardenId: 2_147_483_647 },
        );
    });

    it('rejects partial, non-canonical, non-positive, and overflowing IDs', () => {
        for (const gardenId of [
            '0',
            '-1',
            '01',
            '1junk',
            '2147483648',
            '99999999999',
        ]) {
            assert.equal(
                gardenBlockPurchaseParamSchema.safeParse({ gardenId }).success,
                false,
                gardenId,
            );
        }
    });

    it('accepts legacy bodies without an operation ID and preserves new client IDs', () => {
        assert.deepEqual(
            gardenBlockPurchaseBodySchema.parse({ blockName: 'Raised_Bed' }),
            { blockName: 'Raised_Bed' },
        );
        assert.deepEqual(
            gardenBlockPurchaseBodySchema.parse({
                blockName: 'Raised_Bed',
                operationId: 'client-operation-1',
            }),
            {
                blockName: 'Raised_Bed',
                operationId: 'client-operation-1',
            },
        );
    });
});
