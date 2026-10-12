import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import * as storage from '@gredice/storage';
import { NextRequest } from 'next/server';

const accountId = 'fixture-account';
const userId = 'fixture-user';
const rejectionMessage =
    'Operation is not applicable to the plant in this field';
let role = 'user';
let raisedBedAccountId = accountId;
let appliesToAllTargets = false;
let linkedOperationNames: string[] = [];
let storageFailure: Error | undefined;
let cartCalls = 0;
let mutations = 0;
let flushes = 0;
const backgroundWork: Promise<unknown>[] = [];
const logRecords: Array<{
    level: string;
    message: string;
    attributes?: Record<string, unknown>;
}> = [];

mock.module('@gredice/storage', {
    exports: {
        ...storage,
        getUser: async () => ({
            id: userId,
            role,
            accounts: [{ accountId }],
        }),
        getEntityRaw: async () => {
            if (storageFailure) throw storageFailure;
            return { state: 'published', entityType: { name: 'operation' } };
        },
        getEntityFormatted: async (id: number) =>
            id === 12
                ? {
                      id,
                      information: { name: 'Fixture operation' },
                      attributes: { application: 'plant', appliesToAllTargets },
                  }
                : {
                      id,
                      information: {
                          plant: {
                              information: {
                                  operations: linkedOperationNames.map(
                                      (name) => ({
                                          information: { name },
                                      }),
                                  ),
                              },
                          },
                      },
                  },
        getGarden: async () => ({ accountId: raisedBedAccountId }),
        getRaisedBed: async () => ({
            id: 34,
            accountId: raisedBedAccountId,
            gardenId: 56,
            status: 'active',
            fields: [{ positionIndex: 0, plantSortId: 78 }],
        }),
        getOrCreateShoppingCart: async () => {
            cartCalls += 1;
            return { id: 90, status: 'active', items: [] };
        },
    },
});

mock.module('../checkout/defaultCartItemCurrency.ts', {
    exports: {
        upsertCartItemWithDefaultCurrency: async () => {
            mutations += 1;
            return { cartItemId: 123 };
        },
    },
});

mock.module('../../app/api/mcp/logger.ts', {
    exports: {
        Logger: class {
            info(message: string, attributes?: Record<string, unknown>) {
                logRecords.push({ level: 'info', message, attributes });
            }
            warn(message: string, attributes?: Record<string, unknown>) {
                logRecords.push({ level: 'warn', message, attributes });
            }
            error(message: string, attributes?: Record<string, unknown>) {
                logRecords.push({ level: 'error', message, attributes });
            }
            async flush() {
                assert.equal(
                    logRecords.at(-1)?.message,
                    'mcp.request.complete',
                );
                flushes += 1;
            }
        },
    },
});

mock.module('@vercel/functions', {
    exports: {
        waitUntil: (promise: Promise<unknown>) => backgroundWork.push(promise),
    },
});

// Use the real JWT verifier and real tool dispatch against isolated storage fixtures.
process.env.GREDICE_JWT_SIGN_SECRET = Buffer.from(
    'mcp-regression-test-secret-only',
).toString('base64');
const { createMcpAccessJwt } = await import('../auth/auth');
const { handleMcpRequest } = await import('../../app/api/mcp/server');
const token = await createMcpAccessJwt(userId);

beforeEach(() => {
    role = 'user';
    raisedBedAccountId = accountId;
    appliesToAllTargets = false;
    linkedOperationNames = [];
    storageFailure = undefined;
    cartCalls = 0;
    mutations = 0;
    flushes = 0;
    backgroundWork.length = 0;
    logRecords.length = 0;
});

function operationRequest({
    authorization = `Bearer ${token}`,
    selectedAccount = accountId,
    args = { operationId: 12, raisedBedId: 34, positionIndex: 0 },
}: {
    authorization?: string;
    selectedAccount?: string;
    args?: Record<string, unknown>;
} = {}) {
    return new NextRequest('https://api.gredice.test/api/mcp', {
        method: 'POST',
        headers: {
            authorization,
            'content-type': 'application/json',
            'x-gredice-account-id': selectedAccount,
            'x-correlation-id': 'fixture-correlation',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'operation-call',
            method: 'tools/call',
            params: {
                name: 'commerce/add-operation-to-cart',
                arguments: args,
            },
        }),
    });
}

test('returns a model-visible tool rejection for an inapplicable plant operation without creating a cart', async () => {
    const response = await handleMcpRequest(operationRequest());
    assert.equal(response.status, 200);
    assert.equal(
        response.headers.get('x-correlation-id'),
        'fixture-correlation',
    );
    assert.deepEqual(await response.json(), {
        jsonrpc: '2.0',
        id: 'operation-call',
        result: {
            isError: true,
            content: [{ type: 'text', text: rejectionMessage }],
        },
    });
    assert.equal(cartCalls, 0);
    assert.equal(mutations, 0);
    assert.equal(
        logRecords.some((record) => record.level === 'error'),
        false,
    );
    const rejection = logRecords.find((record) => record.level === 'warn');
    assert.equal(rejection?.message, 'mcp.request.rejected');
    // A strict allowlist prevents cart arguments, credentials and personal data
    // from entering the new rejection diagnostic.
    assert.deepEqual(rejection?.attributes, {
        correlationId: 'fixture-correlation',
        method: 'tools/call',
        toolName: 'commerce/add-operation-to-cart',
        latencyMs: rejection?.attributes?.latencyMs,
        status: 'rejected',
        errorType: 'operation_not_applicable',
    });
    assert.equal(typeof rejection?.attributes?.latencyMs, 'number');
    assert.equal(flushes, 1);
    assert.equal(backgroundWork.length, 1);
    await Promise.all(backgroundWork);
});

for (const applicability of ['linked', 'universal']) {
    test(`adds an applicable ${applicability} operation to the cart`, async () => {
        if (applicability === 'linked') {
            linkedOperationNames = ['Fixture operation'];
        } else {
            appliesToAllTargets = true;
        }
        const response = await handleMcpRequest(operationRequest());
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.result.isError, undefined);
        assert.equal(body.result.structuredContent.cartItemId, 123);
        assert.equal(cartCalls, 2);
        assert.equal(mutations, 1);
        assert.equal(
            logRecords.some((record) => record.level !== 'info'),
            false,
        );
        assert.equal(backgroundWork.length, 1);
    });
}

for (const authorization of ['', 'Bearer invalid-fixture-token']) {
    test(`requires a valid bearer token (${authorization ? 'invalid' : 'missing'})`, async () => {
        const response = await handleMcpRequest(
            operationRequest({ authorization }),
        );
        assert.equal(response.status, 401);
        assert.match(
            response.headers.get('www-authenticate') ?? '',
            /Bearer.*resource_metadata=/,
        );
        assert.equal(cartCalls, 0);
        assert.equal(mutations, 0);
        assert.equal(backgroundWork.length, 1);
    });
}

test('rejects selecting an account outside the authenticated membership', async () => {
    const response = await handleMcpRequest(
        operationRequest({ selectedAccount: 'other-account' }),
    );
    assert.equal(response.status, 403);
    assert.equal(cartCalls, 0);
    assert.equal(mutations, 0);
});

test('requires the mutation scope', async () => {
    role = 'viewer';
    const response = await handleMcpRequest(operationRequest());
    assert.equal(response.status, 403);
    assert.equal(cartCalls, 0);
    assert.equal(mutations, 0);
});

test('keeps ownership validation ahead of operation applicability and cart mutation', async () => {
    raisedBedAccountId = 'other-account';
    const response = await handleMcpRequest(operationRequest());
    assert.equal(response.status, 500);
    assert.equal(
        (await response.json()).error.message,
        'Raised bed not found for authenticated account',
    );
    assert.equal(cartCalls, 0);
    assert.equal(mutations, 0);
    assert.equal(
        logRecords.some((record) => record.message === 'mcp.request.rejected'),
        false,
    );
});

test('keeps schema errors as invalid-params protocol errors', async () => {
    const response = await handleMcpRequest(
        operationRequest({ args: { operationId: -1 } }),
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, -32602);
    assert.equal(cartCalls, 0);
    assert.equal(mutations, 0);
});

test('does not classify an unexpected failure by its message', async () => {
    storageFailure = new Error(rejectionMessage);
    const response = await handleMcpRequest(operationRequest());
    assert.equal(response.status, 500);
    assert.equal((await response.json()).error.data.category, 'tool_failure');
    assert.equal(cartCalls, 0);
    assert.equal(mutations, 0);
    assert.ok(
        logRecords.some((record) => record.message === 'mcp.request.error'),
    );
    assert.equal(backgroundWork.length, 1);
});
