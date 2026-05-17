import { type APIRequestContext, expect, test } from '@playwright/test';

const MCP_BASE_URL = '/api/mcp';
const PROTECTED_RESOURCE_METADATA =
    '/.well-known/oauth-protected-resource/api/mcp';
const MCP_TEST_BEARER_TOKEN = process.env.GREDICE_MCP_TEST_BEARER_TOKEN;
const MCP_TEST_ACCOUNT_ID = process.env.GREDICE_MCP_TEST_ACCOUNT_ID;

async function callMcp(
    request: APIRequestContext,
    payload: unknown,
    headers?: Record<string, string>,
) {
    return request.post(MCP_BASE_URL, {
        data: payload,
        headers,
    });
}

test.describe('MCP protocol surface', () => {
    test('initializes and negotiates protocol version', async ({ request }) => {
        const response = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'init-1',
            method: 'initialize',
            params: {
                protocolVersion: '2025-03-26',
                capabilities: {},
                clientInfo: { name: 'playwright', version: '1.0.0' },
            },
        });

        expect(response.status()).toBe(200);
        expect(response.headers()['mcp-protocol-version']).toBe('2025-03-26');
        await expect(response.json()).resolves.toMatchObject({
            jsonrpc: '2.0',
            id: 'init-1',
            result: {
                protocolVersion: '2025-03-26',
                serverInfo: {
                    name: 'gredice-mcp',
                    version: expect.any(String),
                },
            },
        });
    });

    test('falls back to default protocol version when unsupported', async ({
        request,
    }) => {
        const response = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'init-unsupported',
            method: 'initialize',
            params: {
                protocolVersion: '1999-01-01',
                capabilities: {},
                clientInfo: { name: 'x', version: '1' },
            },
        });

        expect(response.status()).toBe(200);
        expect(response.headers()['mcp-protocol-version']).toBe('2025-03-26');
    });

    test('lists tools and resources', async ({ request }) => {
        const toolsResponse = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'tools-list',
            method: 'tools/list',
            params: {},
        });
        expect(toolsResponse.status()).toBe(200);
        const tools = await toolsResponse.json();
        expect(tools.result.tools).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'directories/get-plants' }),
                expect.objectContaining({ name: 'directories/get-plant' }),
            ]),
        );

        const resourcesResponse = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'resources-list',
            method: 'resources/list',
            params: {},
        });
        expect([200, 500]).toContain(resourcesResponse.status());
        if (resourcesResponse.status() === 200) {
            const resources = await resourcesResponse.json();
            expect(resources.result.resources).toEqual(expect.any(Array));
        }
    });

    test('supports directory tool execution through unified tools/call', async ({
        request,
    }) => {
        const response = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'directories-list',
            method: 'tools/call',
            params: {
                name: 'directories/get-plants',
                arguments: { limit: 2, offset: 0 },
            },
        });

        expect(response.status()).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            jsonrpc: '2.0',
            id: 'directories-list',
            result: {
                plants: expect.any(Array),
                total: expect.any(Number),
            },
        });
    });

    test('returns method-not-found for unsupported JSON-RPC method', async ({
        request,
    }) => {
        const response = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'unknown-method',
            method: 'not-a-method',
            params: {},
        });

        expect(response.status()).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            jsonrpc: '2.0',
            id: 'unknown-method',
            error: { code: -32601, message: 'Method not found: not-a-method' },
        });
    });
});

test.describe('MCP auth and security', () => {
    test('rejects missing token for auth-read tool with explicit challenge', async ({
        request,
    }) => {
        const response = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'auth-missing',
            method: 'tools/call',
            params: {
                name: 'directories/get-plant',
                arguments: { plantName: 'rajcica', includeSorts: true },
            },
        });

        expect(response.status()).toBe(401);
        expect(response.headers()['www-authenticate']).toContain(
            PROTECTED_RESOURCE_METADATA,
        );
        expect(response.headers()['www-authenticate']).toContain(
            'scope="mcp:read"',
        );
        await expect(response.json()).resolves.toMatchObject({
            error: { code: -32000, message: 'Unauthorized' },
        });
    });

    test('rejects expired/invalid token', async ({ request }) => {
        const response = await callMcp(
            request,
            {
                jsonrpc: '2.0',
                id: 'auth-invalid',
                method: 'tools/call',
                params: {
                    name: 'directories/get-plant',
                    arguments: { plantName: 'rajcica', includeSorts: true },
                },
            },
            { Authorization: 'Bearer not-a-valid-token' },
        );

        expect(response.status()).toBe(401);
    });

    test('rejects disallowed origin', async ({ request }) => {
        const response = await callMcp(
            request,
            {
                jsonrpc: '2.0',
                id: 'origin-fail',
                method: 'tools/list',
                params: {},
            },
            { Origin: 'https://evil.example.com' },
        );

        expect([200, 403]).toContain(response.status());
        if (response.status() === 403) {
            await expect(response.json()).resolves.toMatchObject({
                error: 'Forbidden origin',
            });
        }
    });

    test('publishes protected-resource metadata scopes', async ({
        request,
    }) => {
        const metadataResponse = await request.get(PROTECTED_RESOURCE_METADATA);
        expect(metadataResponse.status()).toBe(200);
        const metadata = await metadataResponse.json();
        expect(metadata.scopes_supported).toEqual(
            expect.arrayContaining(['mcp:read', 'mcp:write', 'mcp:admin']),
        );
    });

    test('enforces selected-account isolation on protected tool calls when credentials are configured', async ({
        request,
    }) => {
        test.skip(
            !MCP_TEST_BEARER_TOKEN || !MCP_TEST_ACCOUNT_ID,
            'Set GREDICE_MCP_TEST_BEARER_TOKEN and GREDICE_MCP_TEST_ACCOUNT_ID to exercise authenticated MCP account selection.',
        );

        const authorizedResponse = await callMcp(
            request,
            {
                jsonrpc: '2.0',
                id: 'auth-account-ok',
                method: 'tools/call',
                params: {
                    name: 'directories/get-plant',
                    arguments: { plantName: 'rajcica', includeSorts: true },
                },
            },
            {
                Authorization: `Bearer ${MCP_TEST_BEARER_TOKEN ?? ''}`,
                'x-gredice-account-id': MCP_TEST_ACCOUNT_ID ?? '',
            },
        );

        expect(authorizedResponse.status()).toBe(200);
        await expect(authorizedResponse.json()).resolves.toMatchObject({
            jsonrpc: '2.0',
            id: 'auth-account-ok',
            result: expect.any(Object),
        });

        const isolatedResponse = await callMcp(
            request,
            {
                jsonrpc: '2.0',
                id: 'auth-account-isolated',
                method: 'tools/call',
                params: {
                    name: 'directories/get-plant',
                    arguments: { plantName: 'rajcica', includeSorts: true },
                },
            },
            {
                Authorization: `Bearer ${MCP_TEST_BEARER_TOKEN ?? ''}`,
                'x-gredice-account-id': 'unauthorized-account-id',
            },
        );

        expect(isolatedResponse.status()).toBe(403);
        await expect(isolatedResponse.json()).resolves.toMatchObject({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'No authorized account selected' },
        });
    });
});

test.describe('MCP regression and invalid payload handling', () => {
    test('rejects unknown tool with exact status and code', async ({
        request,
    }) => {
        const response = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'unknown-tool',
            method: 'tools/call',
            params: { name: 'directories/does-not-exist', arguments: {} },
        });

        expect(response.status()).toBe(404);
        await expect(response.json()).resolves.toMatchObject({
            error: {
                code: -32601,
                message: 'Method not found: directories/does-not-exist',
            },
        });
    });

    test('rejects invalid schema for tool args', async ({ request }) => {
        const response = await callMcp(request, {
            jsonrpc: '2.0',
            id: 'invalid-schema',
            method: 'tools/call',
            params: {
                name: 'directories/get-plants',
                arguments: { limit: -1 },
            },
        });

        expect(response.status()).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: { code: -32602, message: 'Invalid params' },
        });
    });

    test('rejects malformed JSON-RPC content type payload', async ({
        request,
    }) => {
        const response = await request.post(MCP_BASE_URL, {
            data: 'not-json',
            headers: { 'Content-Type': 'application/json' },
        });

        expect([400, 500]).toContain(response.status());
    });

    test('handles oversized input without protocol success response', async ({
        request,
    }) => {
        const oversized = 'x'.repeat(1_000_000);
        const response = await callMcp(request, {
            jsonrpc: '2.0',
            id: null,
            method: 'tools/call',
            params: {
                name: 'directories/get-plants',
                // Use a public tool and oversized arguments value so auth cannot mask payload validation.
                arguments: oversized,
            },
        });

        expect(response.status()).toBe(413);
        await expect(response.json()).resolves.toMatchObject({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32600, message: 'Request payload too large' },
        });
    });
});
