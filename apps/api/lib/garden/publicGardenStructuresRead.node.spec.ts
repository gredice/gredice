import assert from 'node:assert/strict';
import test from 'node:test';
import { listPublicGardenStructures } from './publicGardenStructuresRead';

test('public garden structure reads recover once from a Neon ErrorEvent', async (t) => {
    const warnings = t.mock.method(console, 'warn', () => undefined);
    let attempts = 0;
    const gardenIds: number[] = [];

    const structures = await listPublicGardenStructures(
        133,
        async (gardenId) => {
            attempts += 1;
            gardenIds.push(gardenId);
            if (attempts === 1) {
                throw Object.assign(new Error('Failed query'), {
                    cause: { type: 'error' },
                });
            }
            return [];
        },
    );

    assert.deepEqual(structures, []);
    assert.equal(attempts, 2);
    assert.deepEqual(gardenIds, [133, 133]);
    assert.deepEqual(
        warnings.mock.calls.map((call) => call.arguments),
        [
            [
                'Transient database read failed; retrying once',
                {
                    gardenId: 133,
                    event: 'storage.database.read.retry',
                    operation: 'list-public-garden-structures',
                    attempt: 1,
                    maxAttempts: 2,
                    error: { kind: 'error-event', code: undefined },
                },
            ],
            [
                'Database read recovered after transient failure',
                {
                    gardenId: 133,
                    event: 'storage.database.read.recovered',
                    operation: 'list-public-garden-structures',
                    attempt: 2,
                    error: { kind: 'error-event', code: undefined },
                },
            ],
        ],
    );
});

test('public garden structure reads do not retry non-transient failures', async (t) => {
    const errors = t.mock.method(console, 'error', () => undefined);
    const permanentError = Object.assign(new Error('Failed query'), {
        code: '23505',
    });
    let attempts = 0;

    await assert.rejects(
        listPublicGardenStructures(133, async () => {
            attempts += 1;
            throw permanentError;
        }),
        (error) => error === permanentError,
    );

    assert.equal(attempts, 1);
    assert.deepEqual(errors.mock.calls.at(-1)?.arguments, [
        'Database read failed',
        {
            gardenId: 133,
            event: 'storage.database.read.failed',
            operation: 'list-public-garden-structures',
            attempt: 1,
            maxAttempts: 2,
            retryable: false,
            error: { kind: 'error', code: '23505' },
        },
    ]);
});
