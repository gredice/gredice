import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDeliveryRunStart } from './deliveryRunStart';

test('tokenless retry returns the active run without preparing another route', async () => {
    const calls: string[] = [];
    const existingRun = { id: 'run-existing' };

    const result = await resolveDeliveryRunStart({
        getExistingRun: async () => {
            calls.push('existing');
            return existingRun;
        },
        createPreparationToken: async () => {
            calls.push('prepare');
            return 'new-token';
        },
        consumePreparation: async (token) => {
            calls.push(`consume:${token}`);
            return { id: 'run-created' };
        },
    });

    assert.equal(result, existingRun);
    assert.deepEqual(calls, ['existing']);
});

test('prepared start consumes its token without consulting the active run', async () => {
    const calls: string[] = [];

    const result = await resolveDeliveryRunStart({
        preparationToken: 'prepared-token',
        getExistingRun: async () => {
            calls.push('existing');
            return undefined;
        },
        createPreparationToken: async () => {
            calls.push('prepare');
            return 'new-token';
        },
        consumePreparation: async (token) => {
            calls.push(`consume:${token}`);
            return { id: 'run-created' };
        },
    });

    assert.deepEqual(result, { id: 'run-created' });
    assert.deepEqual(calls, ['consume:prepared-token']);
});

test('new tokenless start prepares and consumes one private plan', async () => {
    const calls: string[] = [];

    const result = await resolveDeliveryRunStart({
        getExistingRun: async () => {
            calls.push('existing');
            return undefined;
        },
        createPreparationToken: async () => {
            calls.push('prepare');
            return 'new-token';
        },
        consumePreparation: async (token) => {
            calls.push(`consume:${token}`);
            return { id: 'run-created' };
        },
    });

    assert.deepEqual(result, { id: 'run-created' });
    assert.deepEqual(calls, ['existing', 'prepare', 'consume:new-token']);
});
