import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    GardenEconomicMutationDependencyTimeoutError,
    settleGardenEconomicMutationDependency,
} from './gardenEconomicMutationDependency';

describe('settleGardenEconomicMutationDependency', () => {
    it('preserves fulfilled and rejected dependency outcomes', async () => {
        assert.deepEqual(
            await settleGardenEconomicMutationDependency(
                async () => 'ready',
                25,
            ),
            { status: 'fulfilled', value: 'ready' },
        );

        const failure = new Error('Directory unavailable');
        assert.deepEqual(
            await settleGardenEconomicMutationDependency(async () => {
                throw failure;
            }, 25),
            { status: 'rejected', reason: failure },
        );
    });

    it('settles a stalled dependency at the deadline', async () => {
        const result = await settleGardenEconomicMutationDependency(
            () => new Promise(() => undefined),
            5,
        );

        assert.equal(result.status, 'rejected');
        assert.ok(
            result.reason instanceof
                GardenEconomicMutationDependencyTimeoutError,
        );
    });
});
