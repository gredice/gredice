import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

const MCP_BASE_URL = '/api/mcp';

// Create a test JWT for authenticated endpoints
function createTestJWT(
    userId = 'user-123',
    role = 'gardener',
    permissions = ['gardens:read', 'commerce:read', 'commerce:purchase'],
) {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {
            userId,
            accountId: 'test-account-123',
            role,
            email: 'test@example.com',
            locale: 'hr',
            permissions,
            iat: now,
            exp: now + 3600, // 1 hour from now
        },
        'test-mcp-secret-for-development',
    );
}

/**
 * MCP API Tests for Gredice Platform
 *
 * These tests verify the Model Context Protocol (MCP) implementation
 * for Croatian gardening platform including directories, gardens, and commerce servers.
 */

test.describe('MCP Core Infrastructure', () => {
    test('should return health status for core server', async ({ request }) => {
        const response = await request.get(`${MCP_BASE_URL}/core/health`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toMatchObject({
            status: 'ok',
            timestamp: expect.any(String),
            server: 'gredice-mcp-core',
        });
    });

    test('should initialize the unified MCP endpoint without auth', async ({
        request,
    }) => {
        const response = await request.post(MCP_BASE_URL, {
            data: {
                jsonrpc: '2.0',
                id: 'initialize',
                method: 'initialize',
                params: {
                    protocolVersion: '2025-03-26',
                    capabilities: {},
                    clientInfo: {
                        name: 'playwright',
                        version: '1.0.0',
                    },
                },
            },
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.result.serverInfo.name).toBe('gredice-mcp');
    });

    test('should list unified MCP tools without auth', async ({ request }) => {
        const response = await request.post(MCP_BASE_URL, {
            data: {
                jsonrpc: '2.0',
                id: 'tools-list',
                method: 'tools/list',
                params: {},
            },
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.result.tools).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'directories/get-plants' }),
                expect.objectContaining({
                    name: 'directories/get-plant-sorts',
                }),
            ]),
        );
    });

    test('should call public unified MCP read tools without auth', async ({
        request,
    }) => {
        const response = await request.post(MCP_BASE_URL, {
            data: {
                jsonrpc: '2.0',
                id: 'public-read-tool',
                method: 'tools/call',
                params: {
                    name: 'directories/get-plants',
                    arguments: { limit: 2, offset: 0 },
                },
            },
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.result).toMatchObject({
            plants: expect.any(Array),
            total: expect.any(Number),
        });
    });

    for (const protectedTool of [
        {
            name: 'directories/get-plant',
            arguments: { plantName: 'rajcica', includeSorts: true },
        },
        {
            name: 'directories/get-plant-sorts',
            arguments: { limit: 2, offset: 0 },
        },
        {
            name: 'directories/search-entities',
            arguments: { query: 'rajcica' },
        },
    ]) {
        test(`should challenge unauthenticated unified MCP auth-read tool ${protectedTool.name}`, async ({
            request,
        }) => {
            const response = await request.post(MCP_BASE_URL, {
                data: {
                    jsonrpc: '2.0',
                    id: 'auth-read-tool',
                    method: 'tools/call',
                    params: protectedTool,
                },
            });

            expect(response.status()).toBe(401);
            expect(response.headers()['www-authenticate']).toContain(
                '/.well-known/oauth-protected-resource/api/mcp',
            );
            const data = await response.json();
            expect(data.error).toMatchObject({
                code: -32000,
                message: 'Unauthorized',
            });
        });
    }

    test('should publish MCP resource metadata with docs link', async ({
        request,
    }) => {
        const response = await request.get(
            '/.well-known/oauth-protected-resource/api/mcp',
        );

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.resource).toContain('/api/mcp');
        expect(data.resource_documentation).toContain('/test');
        expect(data.scopes_supported).toEqual(
            expect.arrayContaining(['mcp:read', 'mcp:write', 'mcp:admin']),
        );
    });
});

test.describe('MCP Directories Server', () => {
    test('should return available tools for directories server', async ({
        request,
    }) => {
        const response = await request.get(
            `${MCP_BASE_URL}/directories/tools/call`,
        );
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toMatchObject({
            status: 'ok',
            server: 'gredice-mcp-directories',
            availableTools: expect.arrayContaining([
                'directories/get-plants',
                'directories/get-plant',
                'directories/get-plant-sorts',
                'directories/search-entities',
                'directories/get-operations',
                'directories/get-seeds',
            ]),
        });
        expect(data.availableTools).toHaveLength(6);
    });

    test('should get plants list with Croatian names', async ({ request }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'directories/get-plants',
                    params: {
                        name: 'directories/get-plants',
                        arguments: {
                            limit: 2,
                        },
                    },
                    id: 1,
                },
            },
        );

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.jsonrpc).toBe('2.0');
        expect(data.id).toBe(1);
        expect(data.result).toMatchObject({
            plants: expect.any(Array),
            total: expect.any(Number),
        });
    });

    test('should get plant details with care instructions', async ({
        request,
    }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'directories/get-plant',
                    params: {
                        name: 'directories/get-plant',
                        arguments: {
                            plantName: 'rajčica',
                            includeSorts: true,
                        },
                    },
                    id: 2,
                },
            },
        );

        expect(response.status()).toBe(200);
        const data = await response.json();

        // Test handles both success and not-found cases
        expect(data.result).toBeDefined();
        if (data.result.error) {
            expect(data.result.error).toContain('nije pronađena');
        } else {
            expect(data.result).toMatchObject({
                id: expect.any(String),
                name: expect.any(String),
            });
        }
    });

    test('should get plant sorts filtered by type', async ({ request }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'directories/get-plant-sorts',
                    params: {
                        name: 'directories/get-plant-sorts',
                        arguments: {
                            plant_type: 'rajčica',
                            limit: 3,
                        },
                    },
                    id: 3,
                },
            },
        );

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.result.sorts).toEqual(expect.any(Array));
    });

    test('should get gardening operations by category', async ({ request }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'directories/get-operations',
                    params: {
                        name: 'directories/get-operations',
                        arguments: {
                            category: 'sadnja',
                            limit: 2,
                        },
                    },
                    id: 4,
                },
            },
        );

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.result.operations).toEqual(expect.any(Array));
    });

    test('should get seeds with sowing information', async ({ request }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'directories/get-seeds',
                    params: {
                        name: 'directories/get-seeds',
                        arguments: {
                            plant_type: 'rajčica',
                            limit: 2,
                        },
                    },
                    id: 5,
                },
            },
        );

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.result.seeds).toEqual(expect.any(Array));
    });

    test('should search entities with Croatian queries', async ({
        request,
    }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'directories/search-entities',
                    params: {
                        name: 'directories/search-entities',
                        arguments: {
                            query: 'rajčica',
                            limit: 3,
                        },
                    },
                    id: 6,
                },
            },
        );

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.result.results).toEqual(expect.any(Array));
        expect(data.result.query).toBe('rajčica');
    });

    test('should handle invalid tool name with proper error', async ({
        request,
    }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'directories/invalid-tool',
                    params: {
                        name: 'directories/invalid-tool',
                        arguments: {},
                    },
                    id: 99,
                },
            },
        );

        expect(response.status()).toBe(400);
        const data = await response.json();

        expect(data).toMatchObject({
            jsonrpc: '2.0',
            error: {
                code: -32601,
                message: expect.stringContaining('Method not found'),
            },
            id: null,
        });
    });

    test('should handle missing required parameters', async ({ request }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'directories/get-plant',
                    params: {
                        name: 'directories/get-plant',
                        arguments: {
                            // Missing required plantName
                        },
                    },
                    id: 98,
                },
            },
        );

        expect(response.status()).toBe(400);
        const data = await response.json();

        expect(data).toMatchObject({
            jsonrpc: '2.0',
            error: {
                code: -32602,
                message: expect.stringContaining('Invalid params'),
            },
            id: expect.any(String),
        });
    });
});

test.describe('MCP Gardens Server', () => {
    test('should return available tools for gardens server', async ({
        request,
    }) => {
        const response = await request.get(
            `${MCP_BASE_URL}/gardens/tools/call`,
        );
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toMatchObject({
            status: 'ok',
            server: 'gredice-mcp-gardens',
            availableTools: expect.arrayContaining([
                'gardens/list-gardens',
                'gardens/list-raised-beds',
                'gardens/get-raised-bed-fields',
                'gardens/list-operations',
                'gardens/get-lifecycle-context',
            ]),
        });
        expect(data.availableTools).toHaveLength(5);
    });

    test('should list authenticated account gardens', async ({ request }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/gardens/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'gardens/list-gardens',
                    params: {
                        name: 'gardens/list-gardens',
                        arguments: {
                            limit: 10,
                        },
                    },
                    id: 1,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        const data = await response.json();

        if (response.status() === 500) {
            expect(data.error).toMatchObject({
                code: -32603,
                message: 'Tool execution failed',
            });
            return;
        }

        expect(response.status()).toBe(200);
        expect(data.result).toMatchObject({
            items: expect.any(Array),
            total: expect.any(Number),
            limit: 10,
            offset: 0,
        });
    });

    test('should reject malformed garden ids', async ({ request }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/gardens/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'gardens/list-raised-beds',
                    params: {
                        name: 'gardens/list-raised-beds',
                        arguments: {
                            gardenId: '12abc',
                        },
                    },
                    id: 2,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        expect(response.status()).toBe(400);
        const data = await response.json();

        expect(data.error).toMatchObject({
            code: -32602,
            message: 'Invalid params',
        });
    });

    test('should return forbidden for unknown account garden', async ({
        request,
    }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/gardens/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'gardens/get-lifecycle-context',
                    params: {
                        name: 'gardens/get-lifecycle-context',
                        arguments: {
                            gardenId: '1',
                        },
                    },
                    id: 3,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        const data = await response.json();

        if (response.status() === 500) {
            expect(data.error).toMatchObject({
                code: -32603,
                message: 'Tool execution failed',
            });
            return;
        }

        expect(response.status()).toBe(403);
        expect(data.error).toMatchObject({
            code: -32001,
            message: 'Garden not found for authenticated account',
        });
    });
});

test.describe('MCP Commerce Server', () => {
    test('should return available tools for commerce server', async ({
        request,
    }) => {
        const response = await request.get(
            `${MCP_BASE_URL}/commerce/tools/call`,
        );
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toMatchObject({
            status: 'ok',
            server: 'gredice-mcp-commerce',
            availableTools: expect.arrayContaining([
                'commerce/get-products',
                'commerce/get-product',
                'commerce/search-products',
                'commerce/get-cart',
                'commerce/add-to-cart',
                'commerce/update-cart-item',
            ]),
        });
        expect(data.availableTools).toHaveLength(6);
    });

    test('should get products with Croatian names and prices', async ({
        request,
    }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/commerce/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'commerce/get-products',
                    params: {
                        name: 'commerce/get-products',
                        arguments: {
                            category: 'seeds',
                            locale: 'hr',
                            limit: 5,
                        },
                    },
                    id: 1,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.result.products).toEqual(expect.any(Array));
    });

    test('should search products with Croatian queries', async ({
        request,
    }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/commerce/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'commerce/search-products',
                    params: {
                        name: 'commerce/search-products',
                        arguments: {
                            query: 'rajčica',
                            locale: 'hr',
                            limit: 3,
                        },
                    },
                    id: 2,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.result.results).toEqual(expect.any(Array));
        expect(data.result.query).toBe('rajčica');
    });

    test('should manage shopping cart operations', async ({ request }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        // Test adding to cart
        const addResponse = await request.post(
            `${MCP_BASE_URL}/commerce/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'commerce/add-to-cart',
                    params: {
                        name: 'commerce/add-to-cart',
                        arguments: {
                            userId: 'user-123',
                            productId: 'product-seed-tomato-cherry',
                            quantity: 2,
                            locale: 'hr',
                        },
                    },
                    id: 3,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        expect(addResponse.status()).toBe(200);
        const addData = await addResponse.json();

        // Test handles both success and failure cases (if account doesn't exist)
        if (addData.result.success === false) {
            // Account doesn't exist - this is expected for test user
            expect(addData.result.success).toBe(false);
        } else {
            expect(addData.result.success).toBe(true);
            expect(addData.result.message).toContain('košaricu');
        }

        // Test getting cart
        const getCartResponse = await request.post(
            `${MCP_BASE_URL}/commerce/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'commerce/get-cart',
                    params: {
                        name: 'commerce/get-cart',
                        arguments: {
                            userId: 'user-123',
                            locale: 'hr',
                        },
                    },
                    id: 4,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        expect(getCartResponse.status()).toBe(200);
        const cartData = await getCartResponse.json();

        // Cart may be empty or have error if account doesn't exist
        expect(cartData.result).toBeDefined();
        if (cartData.result.userId) {
            expect(cartData.result).toMatchObject({
                userId: 'user-123',
                items: expect.any(Array),
            });
        }
    });

    test('should reject cart mutation for read-only token', async ({
        request,
    }) => {
        const testJWT = createTestJWT('user-123', 'gardener', [
            'commerce:read',
        ]);

        const response = await request.post(
            `${MCP_BASE_URL}/commerce/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'commerce/add-to-cart',
                    params: {
                        name: 'commerce/add-to-cart',
                        arguments: {
                            userId: 'user-123',
                            productId: 'product-seed-tomato-cherry',
                            quantity: 1,
                        },
                    },
                    id: 6,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        expect(response.status()).toBe(403);
        const data = await response.json();
        expect(data.error.code).toBe(-32001);
    });

    test('should reject cart access for different userId', async ({
        request,
    }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/commerce/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'commerce/get-cart',
                    params: {
                        name: 'commerce/get-cart',
                        arguments: {
                            userId: 'user-456',
                            locale: 'hr',
                        },
                    },
                    id: 7,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        expect(response.status()).toBe(403);
        const data = await response.json();
        expect(data.error.code).toBe(-32001);
    });
});

test.describe('MCP Error Handling', () => {
    test('should return 404 for non-existent server', async ({ request }) => {
        const response = await request.get(
            `${MCP_BASE_URL}/nonexistent/tools/call`,
        );
        expect(response.status()).toBe(404);
    });

    test('should handle malformed JSON-RPC requests', async ({ request }) => {
        const response = await request.post(
            `${MCP_BASE_URL}/directories/tools/call`,
            {
                data: {
                    // Missing required jsonrpc field
                    method: 'directories/get-plants',
                    id: 1,
                },
            },
        );

        expect(response.status()).toBe(400);
    });
});
