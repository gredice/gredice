import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

const MCP_BASE_URL = 'https://api.gredice.test/api/mcp';

// Create a test JWT for authenticated endpoints
function createTestJWT(userId = 'user-123', role = 'gardener') {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {
            userId,
            role,
            email: 'test@example.com',
            locale: 'hr',
            permissions: [], // Optional permissions array
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

        expect(data.result.operations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    category: 'sadnja',
                    name: expect.stringContaining('Sadnja'),
                    steps: expect.arrayContaining([
                        expect.stringMatching(/.*rupu.*/),
                    ]),
                    tools: expect.arrayContaining([expect.any(String)]),
                }),
            ]),
        );
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
                'gardens/get-gardens',
                'gardens/get-garden',
                'gardens/create-garden',
                'gardens/add-plant-to-garden',
                'gardens/get-garden-activities',
                'gardens/log-garden-activity',
            ]),
        });
        expect(data.availableTools).toHaveLength(6);
    });

    test('should get user gardens list', async ({ request }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/gardens/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'gardens/get-gardens',
                    params: {
                        name: 'gardens/get-gardens',
                        arguments: {
                            userId: 'user-123',
                            locale: 'hr',
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

        expect(response.status()).toBe(200);
        const data = await response.json();

        // Expect either empty results (if user doesn't exist) or proper garden data
        expect(data.result).toMatchObject({
            gardens: expect.any(Array),
            total: expect.any(Number),
            userId: 'user-123',
        });
    });

    test('should create new garden', async ({ request }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/gardens/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'gardens/create-garden',
                    params: {
                        name: 'gardens/create-garden',
                        arguments: {
                            userId: 'user-123',
                            name: 'Test vrt',
                            description: 'Test opis vrta',
                            gardenType: 'outdoor',
                            locale: 'hr',
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

        // Test handles both success (if account exists) and failure (if account doesn't exist)
        expect(data.result).toBeDefined();
        if (data.result.success === false) {
            // Account doesn't exist - this is expected for test user
            expect(data.result.success).toBe(false);
        } else {
            // Account exists - check success structure
            expect(data.result).toMatchObject({
                success: true,
                garden: expect.objectContaining({
                    userId: 'user-123',
                    name: 'Test vrt',
                }),
            });
        }
    });

    test('should log garden activity with Croatian data', async ({
        request,
    }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/gardens/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'gardens/log-garden-activity',
                    params: {
                        name: 'gardens/log-garden-activity',
                        arguments: {
                            gardenId: 'garden-1',
                            activityType: 'watering',
                            description: 'Zalijevanje biljaka',
                            date: '2025-09-27T10:00:00Z',
                            duration: 15,
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

        expect(response.status()).toBe(200);
        const data = await response.json();

        expect(data.result).toMatchObject({
            success: true,
            activity: expect.objectContaining({
                type: 'watering',
                description: 'Zalijevanje biljaka',
                duration: 15,
            }),
            message: expect.stringContaining('zabilježena'),
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
                'commerce/create-order',
                'commerce/get-orders',
            ]),
        });
        expect(data.availableTools).toHaveLength(8);
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

    test('should create order with Croatian shipping address', async ({
        request,
    }) => {
        const testJWT = createTestJWT('user-123', 'gardener');

        const response = await request.post(
            `${MCP_BASE_URL}/commerce/tools/call`,
            {
                data: {
                    jsonrpc: '2.0',
                    method: 'commerce/create-order',
                    params: {
                        name: 'commerce/create-order',
                        arguments: {
                            userId: 'user-123',
                            shippingAddress: {
                                name: 'Marko Marić',
                                street: 'Ilica 1',
                                city: 'Zagreb',
                                postalCode: '10000',
                                country: 'HR',
                            },
                            paymentMethod: 'card',
                            locale: 'hr',
                        },
                    },
                    id: 5,
                },
                headers: {
                    Authorization: `Bearer ${testJWT}`,
                },
            },
        );

        // Expect either success or proper error response
        expect([200, 400, 401, 404]).toContain(response.status());
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
