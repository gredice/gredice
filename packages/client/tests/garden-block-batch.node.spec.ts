import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    GardenBlockBatchRequestError,
    parseGardenBlockBatchPurchaseBody,
    placeGardenBlockBatch,
} from '../src/garden-block-batch';

const body = {
    operationId: randomUUID(),
    blockName: 'Bush',
    rotation: 5,
    expectedUnitPrice: 10,
    placements: [
        { position: { x: 1, y: 0 }, expectedExistingBlocks: ['ground-1'] },
        { position: { x: 0, y: 0 }, expectedExistingBlocks: [] },
    ],
};
const input = { gardenId: 12, ...body };
const receipt = {
    operationId: body.operationId,
    blockName: 'Bush',
    rotation: 1,
    unitPrice: 10,
    chargedSunflowers: 20,
    placements: [
        { id: 'block-a', position: { x: 1, y: 0 } },
        { id: 'block-b', position: { x: 0, y: 0 } },
    ],
    replayed: false,
};

async function withFetch(
    respond: (request: Request) => Response | Promise<Response>,
    fn: () => Promise<void>,
) {
    const previous = globalThis.fetch;
    globalThis.fetch = async (resource, init) =>
        respond(new Request(resource, init));
    try {
        await fn();
    } finally {
        globalThis.fetch = previous;
    }
}

test('body parser accepts the contract and rejects duplicates, extra keys and oversize batches', () => {
    assert.deepEqual(parseGardenBlockBatchPurchaseBody(body), body);
    assert.deepEqual(
        parseGardenBlockBatchPurchaseBody({ ...body, rotation: null }),
        { ...body, rotation: null },
    );
    for (const invalid of [
        { ...body, gardenId: 12 },
        { ...body, operationId: 'retry-1' },
        {
            ...body,
            placements: [body.placements[0], body.placements[0]],
        },
        {
            ...body,
            placements: Array.from({ length: 101 }, (_, x) => ({
                position: { x, y: 0 },
                expectedExistingBlocks: [],
            })),
        },
        null,
    ]) {
        assert.equal(parseGardenBlockBatchPurchaseBody(invalid), null);
    }
});

test('posts the exact body to the batch route and returns the verified receipt', async () => {
    const requests: { method: string; path: string; json: unknown }[] = [];
    await withFetch(
        async (request) => {
            requests.push({
                method: request.method,
                path: new URL(request.url).pathname,
                json: await request.json(),
            });
            return Response.json(receipt);
        },
        async () => {
            assert.deepEqual(await placeGardenBlockBatch(input), receipt);
        },
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.method, 'POST');
    assert.ok(requests[0]?.path.endsWith('/api/gardens/12/blocks/batch'));
    assert.deepEqual(requests[0]?.json, body);
});

test('a receipt that does not match the command is an uncertain INVALID_RECEIPT', async () => {
    for (const mismatch of [
        null,
        { ...receipt, operationId: randomUUID() },
        { ...receipt, rotation: 5 },
        { ...receipt, unitPrice: 9 },
        { ...receipt, chargedSunflowers: 10 },
        { ...receipt, placements: receipt.placements.slice(1) },
        { ...receipt, placements: [...receipt.placements].reverse() },
        {
            ...receipt,
            placements: receipt.placements.map((placement) => ({
                ...placement,
                id: 'same',
            })),
        },
    ]) {
        await withFetch(
            () => Response.json(mismatch),
            async () =>
                assert.rejects(
                    placeGardenBlockBatch(input),
                    (error) =>
                        error instanceof GardenBlockBatchRequestError &&
                        error.code === 'INVALID_RECEIPT' &&
                        error.uncertain,
                ),
        );
    }
});

test('definitive errors expose their code and details; uncertain ones keep the pending command', async () => {
    await withFetch(
        () =>
            Response.json(
                {
                    code: 'GARDEN_STATE_CHANGED',
                    error: 'Garden changed',
                    conflicts: [{ index: 1, reason: 'stack-changed' }],
                },
                { status: 409 },
            ),
        async () =>
            assert.rejects(
                placeGardenBlockBatch(input),
                (error) =>
                    error instanceof GardenBlockBatchRequestError &&
                    !error.uncertain &&
                    error.status === 409 &&
                    error.code === 'GARDEN_STATE_CHANGED' &&
                    error.details.conflicts?.[0]?.index === 1,
            ),
    );
    await withFetch(
        () =>
            Response.json(
                {
                    code: 'INSUFFICIENT_SUNFLOWERS',
                    error: 'Insufficient sunflowers',
                    availableAmount: 35,
                    requiredAmount: 100,
                    affordableCount: 3,
                },
                { status: 400 },
            ),
        async () =>
            assert.rejects(
                placeGardenBlockBatch(input),
                (error) =>
                    error instanceof GardenBlockBatchRequestError &&
                    !error.uncertain &&
                    error.details.affordableCount === 3,
            ),
    );
    await withFetch(
        () =>
            Response.json(
                {
                    code: 'RATE_LIMITED',
                    error: 'Too many',
                    retryAfterSeconds: 120,
                },
                { status: 429, headers: { 'Retry-After': '90' } },
            ),
        async () =>
            assert.rejects(
                placeGardenBlockBatch(input),
                (error) =>
                    error instanceof GardenBlockBatchRequestError &&
                    !error.uncertain &&
                    error.code === 'RATE_LIMITED' &&
                    error.details.retryAfterSeconds === 90,
            ),
    );
    for (const [status, payload] of [
        [429, { code: 'EDGE_THROTTLED', error: 'Slow down' }],
        [401, { error: 'Unauthorized' }],
        [403, { error: 'Forbidden' }],
        [408, null],
        [500, { code: 'OPERATION_FAILED', error: 'Failed' }],
        [503, { code: 'BLOCK_DIRECTORY_UNAVAILABLE', error: 'Down' }],
    ] as const) {
        await withFetch(
            () => Response.json(payload, { status }),
            async () =>
                assert.rejects(
                    placeGardenBlockBatch(input),
                    (error) =>
                        error instanceof GardenBlockBatchRequestError &&
                        error.status === status &&
                        error.uncertain,
                ),
        );
    }
    await withFetch(
        () => {
            throw new TypeError('Lost connection');
        },
        async () =>
            assert.rejects(
                placeGardenBlockBatch(input),
                (error) =>
                    error instanceof GardenBlockBatchRequestError &&
                    error.status === 0 &&
                    error.code === 'NETWORK_ERROR' &&
                    error.uncertain,
            ),
    );
});
