import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { gardenBlockBatchPurchaseResponseSchema } from '@gredice/storage/gardenBlockBatchPurchaseContract';
import { createGardenBlockBatchPurchaseRoutes } from '../../app/api/[...route]/gardenBlockBatchPurchaseRoutes';
import type { GardenBlockBatchPurchaseCommand } from './gardenBlockBatchPurchaseService';

type Dependencies = NonNullable<
    Parameters<typeof createGardenBlockBatchPurchaseRoutes>[0]
>;

const accountId = randomUUID();

function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
    return {
        authValidator: () => async (context, next) => {
            context.set('authContext', {
                accountId,
                userId: 'fixture',
                user: {
                    id: 'fixture',
                    accountIds: [accountId],
                    isTemporary: false,
                    role: 'user',
                },
            });
            await next();
        },
        isReplay: async () => false,
        rateLimit: async () => ({ allowed: true }),
        purchase: async (command) => ({
            ok: true,
            operationId: command.operationId,
            blockName: command.blockName,
            rotation: 1,
            unitPrice: 10,
            chargedSunflowers: 10 * command.placements.length,
            placements: command.placements.map((placement, index) => ({
                id: `block-${index.toString()}`,
                position: placement.position,
            })),
            replayed: false,
        }),
        ...overrides,
    };
}

function body(overrides: Readonly<Record<string, unknown>> = {}) {
    return {
        operationId: randomUUID(),
        blockName: 'Bush',
        rotation: 0,
        expectedUnitPrice: 10,
        placements: [
            { position: { x: 1, y: 0 }, expectedExistingBlocks: ['ground'] },
            { position: { x: 2, y: 0 }, expectedExistingBlocks: [] },
        ],
        ...overrides,
    };
}

function request(json: unknown) {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
    };
}

const path = '/12/blocks/batch';

test('401 authentication precedes validation, rate limiting and the purchase', async () => {
    const app = createGardenBlockBatchPurchaseRoutes(
        dependencies({
            authValidator: () => async (context) =>
                context.json({ error: 'Unauthorized' }, 401),
            isReplay: async () => assert.fail('Replay check reached'),
            rateLimit: async () => assert.fail('Rate limit consumed'),
            purchase: async () => assert.fail('Purchase reached'),
        }),
    );
    assert.equal((await app.request(path, request(body()))).status, 401);
    assert.equal(
        (await app.request(path, request({ nonsense: true }))).status,
        401,
    );
});

test('invalid garden IDs and bodies are 400 INVALID_REQUEST without consuming the rate limit', async () => {
    const app = createGardenBlockBatchPurchaseRoutes(
        dependencies({
            isReplay: async () => assert.fail('Replay check reached'),
            rateLimit: async () => assert.fail('Rate limit consumed'),
            purchase: async () => assert.fail('Invalid command accepted'),
        }),
    );
    const tooMany = Array.from({ length: 101 }, (_, x) => ({
        position: { x, y: 0 },
        expectedExistingBlocks: [],
    }));
    const duplicate = [
        { position: { x: 0, y: 0 }, expectedExistingBlocks: [] },
        { position: { x: 0, y: 0 }, expectedExistingBlocks: [] },
    ];
    const cases: [string, unknown][] = [
        ['/0/blocks/batch', body()],
        ['/abc/blocks/batch', body()],
        [path, body({ placements: tooMany })],
        [path, body({ placements: duplicate })],
        [path, body({ placements: [] })],
        [path, body({ operationId: 'not-a-uuid' })],
        [path, body({ unitPrice: 0 })],
        [path, body({ accountId: randomUUID() })],
        [path, body({ gardenId: 13 })],
        [path, body({ expectedUnitPrice: -1 })],
        [path, body({ rotation: 0.5 })],
        [path, body({ rotation: 2_147_483_648 })],
        [
            path,
            body({
                placements: [
                    {
                        position: { x: 0, y: 0, z: 1 },
                        expectedExistingBlocks: [],
                    },
                ],
            }),
        ],
        [
            path,
            body({
                placements: [
                    {
                        position: { x: 0, y: 0 },
                        expectedExistingBlocks: Array.from(
                            { length: 129 },
                            (_, index) => `block-${index.toString()}`,
                        ),
                    },
                ],
            }),
        ],
        [path, body({ blockName: ' Bush' })],
    ];
    for (const [url, json] of cases) {
        const response = await app.request(url, request(json));
        assert.equal(response.status, 400, `${url} ${JSON.stringify(json)}`);
        const result = await response.json();
        assert.equal(result.code, 'INVALID_REQUEST');
        assert.equal(typeof result.error, 'string');
    }
});

test('rotation 5 and null are accepted and passed to the service with the server-owned account and garden', async () => {
    const commands: GardenBlockBatchPurchaseCommand[] = [];
    const app = createGardenBlockBatchPurchaseRoutes(
        dependencies({
            // An allowed request never needs the replay check.
            isReplay: async () => assert.fail('Replay check reached'),
            purchase: async (command) => {
                commands.push(command);
                return dependencies().purchase(command);
            },
        }),
    );
    for (const rotation of [5, null]) {
        const response = await app.request(path, request(body({ rotation })));
        assert.equal(response.status, 200);
        assert.equal(
            response.headers.get('Cache-Control'),
            'private, no-store',
        );
        const parsed = gardenBlockBatchPurchaseResponseSchema.safeParse(
            await response.json(),
        );
        assert.equal(parsed.success, true);
    }
    assert.deepEqual(
        commands.map((command) => [
            command.rotation,
            command.accountId,
            command.gardenId,
        ]),
        [
            [5, accountId, 12],
            [null, accountId, 12],
        ],
    );
});

test('a denied rate limit returns 429 RATE_LIMITED with Retry-After before the purchase', async () => {
    const limited: string[] = [];
    const replayChecks: Parameters<Dependencies['isReplay']>[0][] = [];
    const app = createGardenBlockBatchPurchaseRoutes(
        dependencies({
            isReplay: async (input) => {
                replayChecks.push(input);
                return false;
            },
            rateLimit: async (limitedAccountId) => {
                limited.push(limitedAccountId);
                return { allowed: false, retryAfterSeconds: 321 };
            },
            purchase: async () => assert.fail('Purchase reached'),
        }),
    );
    const json = body();
    const response = await app.request(path, request(json));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '321');
    assert.deepEqual(await response.json(), {
        code: 'RATE_LIMITED',
        error: 'Too many garden block batch requests',
        retryAfterSeconds: 321,
    });
    assert.deepEqual(limited, [accountId]);
    assert.deepEqual(replayChecks, [{ body: json, gardenId: 12 }]);
});

test('an exact retry of a committed batch passes a denied rate limit and gets its receipt', async () => {
    const commands: GardenBlockBatchPurchaseCommand[] = [];
    const app = createGardenBlockBatchPurchaseRoutes(
        dependencies({
            isReplay: async () => true,
            rateLimit: async () => ({ allowed: false, retryAfterSeconds: 60 }),
            purchase: async (command) => {
                commands.push(command);
                const result = await dependencies().purchase(command);
                return result.ok ? { ...result, replayed: true } : result;
            },
        }),
    );
    const json = body();
    const response = await app.request(path, request(json));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Retry-After'), null);
    const parsed = gardenBlockBatchPurchaseResponseSchema.parse(
        await response.json(),
    );
    assert.equal(parsed.replayed, true);
    assert.equal(parsed.operationId, json.operationId);
    assert.deepEqual(
        commands.map((command) => [command.accountId, command.gardenId]),
        [[accountId, 12]],
    );
});

test('service failures keep their status, code and details', async () => {
    const app = createGardenBlockBatchPurchaseRoutes(
        dependencies({
            purchase: async () => ({
                ok: false,
                code: 'GARDEN_STATE_CHANGED',
                details: {
                    conflicts: [{ index: 1, reason: 'stack-changed' }],
                },
                error: 'Garden changed since the expansion was planned',
                status: 409,
            }),
        }),
    );
    const response = await app.request(path, request(body()));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
        code: 'GARDEN_STATE_CHANGED',
        conflicts: [{ index: 1, reason: 'stack-changed' }],
        error: 'Garden changed since the expansion was planned',
    });

    const insufficient = createGardenBlockBatchPurchaseRoutes(
        dependencies({
            purchase: async () => ({
                ok: false,
                code: 'INSUFFICIENT_SUNFLOWERS',
                details: {
                    affordableCount: 3,
                    availableAmount: 35,
                    requiredAmount: 100,
                },
                error: 'Insufficient sunflowers',
                status: 400,
            }),
        }),
    );
    const poor = await insufficient.request(path, request(body()));
    assert.equal(poor.status, 400);
    assert.deepEqual(await poor.json(), {
        affordableCount: 3,
        availableAmount: 35,
        code: 'INSUFFICIENT_SUNFLOWERS',
        error: 'Insufficient sunflowers',
        requiredAmount: 100,
    });
});
