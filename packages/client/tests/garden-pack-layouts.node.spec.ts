import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    GardenPackGroupPlacementRequestError,
    getGardenPackLayouts,
    parseGardenPackGroupPlacementBody,
    placeGardenPackLayout,
} from '../src/garden-pack-layouts';

const input = {
    purchaseId: randomUUID(),
    layoutId: 'harvest-corner',
    operationId: randomUUID(),
    expectedAccountId: randomUUID(),
    gardenId: 1,
    layoutVersionId: 'layout:v1',
    anchor: { x: 0, y: 0 },
    rotation: 0,
    units: [{ slotId: 'one', lineId: 'one', unitOrdinal: 1 }],
    expectedStacks: [{ positionX: 0, positionY: 0, blocks: ['ground'] }],
};
const response = {
    operationId: input.operationId,
    purchaseId: input.purchaseId,
    gardenId: 1,
    layoutId: input.layoutId,
    layoutVersionId: input.layoutVersionId,
    chargedSunflowers: 0,
    replayed: false,
    placements: [
        {
            slotId: 'one',
            lineId: 'one',
            unitOrdinal: 1,
            blockId: 'block',
            variant: null,
            position: { x: 0, y: 0 },
            modelName: 'GardenScarecrow',
            rotation: 0,
            existingBlocks: ['ground'],
        },
    ],
};
async function withFetch(
    payload: unknown,
    status: number,
    fn: () => Promise<void>,
) {
    const previous = globalThis.fetch;
    globalThis.fetch = async () => Response.json(payload, { status });
    try {
        await fn();
    } finally {
        globalThis.fetch = previous;
    }
}
test('durable command parser rejects arbitrary content and accepts exact complete body', () => {
    const { purchaseId: _p, layoutId: _l, ...body } = input;
    assert.deepEqual(parseGardenPackGroupPlacementBody(body), body);
    assert.equal(
        parseGardenPackGroupPlacementBody({ ...body, offsets: [] }),
        null,
    );
    assert.equal(
        parseGardenPackGroupPlacementBody({
            ...body,
            expectedAccountId: 'other',
        }),
        null,
    );
});
test('helper accepts validated receipt but treats malformed and mismatched receipts as uncertain', async () => {
    await withFetch(response, 200, async () =>
        assert.deepEqual(await placeGardenPackLayout(input), response),
    );
    for (const receipt of [
        null,
        { ...response, chargedSunflowers: 1 },
        { ...response, operationId: randomUUID() },
        { ...response, purchaseId: randomUUID() },
        { ...response, placements: [] },
    ]) {
        await withFetch(receipt, 200, async () =>
            assert.rejects(
                placeGardenPackLayout(input),
                (error) =>
                    error instanceof GardenPackGroupPlacementRequestError &&
                    error.uncertain &&
                    error.code === 'INVALID_RECEIPT',
            ),
        );
    }
});
test('timeouts, auth, owner switch, network loss preserve pending while definitive collision can clear', async () => {
    for (const status of [401, 403, 408, 429, 500, 503])
        await withFetch({ code: 'ERROR', error: 'Failed' }, status, async () =>
            assert.rejects(
                placeGardenPackLayout(input),
                (error) =>
                    error instanceof GardenPackGroupPlacementRequestError &&
                    error.uncertain,
            ),
        );
    await withFetch(
        { code: 'EXPECTED_ACCOUNT_MISMATCH', error: 'Changed' },
        409,
        async () =>
            assert.rejects(
                placeGardenPackLayout(input),
                (error) =>
                    error instanceof GardenPackGroupPlacementRequestError &&
                    error.uncertain,
            ),
    );
    await withFetch(
        { code: 'GROUP_PLACEMENT_INVALID', error: 'Collision' },
        409,
        async () =>
            assert.rejects(
                placeGardenPackLayout(input),
                (error) =>
                    error instanceof GardenPackGroupPlacementRequestError &&
                    !error.uncertain,
            ),
    );
    const previous = globalThis.fetch;
    globalThis.fetch = async () => {
        throw new Error('Lost response');
    };
    try {
        await assert.rejects(
            placeGardenPackLayout(input),
            (error) =>
                error instanceof GardenPackGroupPlacementRequestError &&
                error.uncertain,
        );
    } finally {
        globalThis.fetch = previous;
    }
});
test('layout reads validate runtime shape and purchase identity', async () => {
    const dto = {
        enabled: true,
        accountId: input.expectedAccountId,
        purchaseId: input.purchaseId,
        layouts: [],
    };
    await withFetch(dto, 200, async () =>
        assert.deepEqual(await getGardenPackLayouts(input.purchaseId), dto),
    );
    await withFetch({ ...dto, purchaseId: randomUUID() }, 200, async () =>
        assert.rejects(getGardenPackLayouts(input.purchaseId)),
    );
});
