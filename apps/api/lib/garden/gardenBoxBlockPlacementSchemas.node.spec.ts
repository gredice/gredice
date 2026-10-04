import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi';
import {
    gardenBoxBlockPlacementBodySchema,
    resolveGardenBoxBlockPlacementOperationId,
} from './gardenBoxBlockPlacementSchemas';

describe('garden box block placement route schema', () => {
    it('accepts an old client request without a JSON body', async () => {
        const app = new Hono().post(
            '/',
            zValidator('json', gardenBoxBlockPlacementBodySchema),
            (context) => context.json(context.req.valid('json')),
        );

        const response = await app.request('/', { method: 'POST' });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {});
    });

    it('preserves a bounded client ID and rejects malformed IDs', () => {
        assert.deepEqual(
            gardenBoxBlockPlacementBodySchema.parse({
                operationId: 'garden-box-operation-1',
            }),
            { operationId: 'garden-box-operation-1' },
        );
        for (const operationId of [
            '',
            ' operation',
            'operation ',
            'x'.repeat(97),
        ]) {
            assert.equal(
                gardenBoxBlockPlacementBodySchema.safeParse({ operationId })
                    .success,
                false,
            );
        }
    });

    it('generates a bounded one-shot fallback only for legacy clients', () => {
        assert.equal(
            resolveGardenBoxBlockPlacementOperationId('client-operation'),
            'client-operation',
        );
        const fallback = resolveGardenBoxBlockPlacementOperationId(
            undefined,
            () => '00000000-0000-4000-8000-000000000000',
        );
        assert.equal(
            fallback,
            'legacy-garden-box-place-00000000-0000-4000-8000-000000000000',
        );
        assert.equal(fallback.length <= 96, true);
    });
});
