import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createGardenPackGroupPlacementRoutes } from '../../app/api/[...route]/gardenPackGroupPlacementRoutes';

type Dependencies = NonNullable<
    Parameters<typeof createGardenPackGroupPlacementRoutes>[0]
>;
const accountId = randomUUID();
const purchaseId = randomUUID();
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
        isStorageEnabled: () => true,
        isStorageReady: async () => true,
        getPack: async () => undefined,
        getBlocks: async () => [],
        place: async () => ({
            ok: false,
            status: 409,
            code: 'GROUP_PLACEMENT_INVALID',
            error: 'Collision',
        }),
        ...overrides,
    };
}
function body() {
    return {
        operationId: randomUUID(),
        expectedAccountId: accountId,
        gardenId: 1,
        layoutVersionId: 'layout:v1',
        anchor: { x: 0, y: 0 },
        rotation: 0,
        units: [{ slotId: 'one', lineId: 'one', unitOrdinal: 1 }],
        expectedStacks: [{ positionX: 0, positionY: 0, blocks: [] }],
    };
}
const path = `/${purchaseId}/layouts/harvest-corner/place`;
function request(json: unknown) {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
    };
}
test('401 authentication precedes readiness, pack and directory access for reads and mutation', async () => {
    const app = createGardenPackGroupPlacementRoutes(
        dependencies({
            authValidator: () => async (context) =>
                context.json({ error: 'Unauthorized' }, 401),
            isStorageReady: async () => assert.fail('Readiness accessed'),
        }),
    );
    assert.equal((await app.request(`/${purchaseId}/layouts`)).status, 401);
    assert.equal((await app.request(path, request(body()))).status, 401);
});
test('rollout default-off and partial readiness never touch absent pack tables', async () => {
    for (const ready of [false, true]) {
        const app = createGardenPackGroupPlacementRoutes(
            dependencies({
                isStorageEnabled: () => ready,
                isStorageReady: async () => false,
                getPack: async () => assert.fail('Pack table accessed'),
                place: async () => assert.fail('Mutation accessed'),
            }),
        );
        const read = await app.request(`/${purchaseId}/layouts`);
        assert.equal(read.status, 200);
        assert.equal(read.headers.get('Cache-Control'), 'private, no-store');
        assert.deepEqual(await read.json(), {
            enabled: false,
            accountId: null,
            purchaseId,
            layouts: [],
        });
        assert.equal(
            (await app.request(path, request(body()))).status,
            ready ? 503 : 404,
        );
    }
});
test('foreign reads 404, server owner controls mutation and owner-switch precondition rejects before storage', async () => {
    const owners: string[] = [];
    const app = createGardenPackGroupPlacementRoutes(
        dependencies({
            getPack: async (owner) => {
                owners.push(owner);
                return undefined;
            },
            place: async (command) => {
                owners.push(command.accountId);
                assert.equal(command.expectedAccountId, accountId);
                return {
                    ok: false,
                    status: 409,
                    code: 'GROUP_PLACEMENT_INVALID',
                    error: 'Collision',
                };
            },
        }),
    );
    assert.equal(
        (await app.request(`/${purchaseId}/layouts?accountId=${randomUUID()}`))
            .status,
        404,
    );
    const result = await app.request(path, request(body()));
    assert.equal(result.status, 409);
    assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(owners, [accountId, accountId]);
    const guarded = createGardenPackGroupPlacementRoutes(
        dependencies({
            isStorageReady: async () => assert.fail('Readiness accessed'),
            place: async () => assert.fail('Mutation accessed'),
        }),
    );
    const switched = await guarded.request(
        path,
        request({ ...body(), expectedAccountId: randomUUID() }),
    );
    assert.equal(switched.status, 409);
    assert.equal((await switched.json()).code, 'EXPECTED_ACCOUNT_MISMATCH');
});
test('strict body rejects arbitrary offsets/content/account override, duplicate shape bounds and invalid quarter turns', async () => {
    const app = createGardenPackGroupPlacementRoutes(
        dependencies({
            place: async () => assert.fail('Invalid command accepted'),
        }),
    );
    for (const json of [
        { ...body(), accountId: randomUUID() },
        { ...body(), offsets: [] },
        { ...body(), rotation: 4 },
        { ...body(), units: [] },
        { ...body(), expectedStacks: [] },
        {
            ...body(),
            units: [
                {
                    slotId: 'one',
                    lineId: 'one',
                    unitOrdinal: 1,
                    modelName: 'Substitution',
                },
            ],
        },
        { ...body(), operationId: 'not-a-uuid' },
    ]) {
        assert.equal((await app.request(path, request(json))).status, 400);
    }
    assert.equal((await app.request('/invalid/layouts')).status, 400);
});
