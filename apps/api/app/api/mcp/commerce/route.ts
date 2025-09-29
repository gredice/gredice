import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Logger } from 'next-axiom';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        jsonrpc: '2.0',
        result: {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {
                    listChanged: false,
                },
                resources: {},
                prompts: {},
            },
            serverInfo: {
                name: 'gredice-mcp-commerce',
                version: '1.0.0',
                description: 'Seeds & tools marketplace',
            },
        },
    });
}

export async function POST(request: NextRequest) {
    const logger = new Logger();

    try {
        const body = await request.json();
        const { method } = body;

        logger.info('mcp.commerce.request', {
            method,
            timestamp: new Date().toISOString(),
        });

        switch (method) {
            case 'initialize':
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {
                                listChanged: false,
                            },
                            resources: {},
                            prompts: {},
                        },
                        serverInfo: {
                            name: 'gredice-mcp-commerce',
                            version: '1.0.0',
                        },
                    },
                    id: body.id,
                });

            case 'prompts/list':
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        prompts: [],
                    },
                    id: body.id,
                });

            case 'tools/list':
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        tools: [
                            {
                                name: 'commerce-get-products',
                                description:
                                    'Get product catalog with Croatian names and EUR prices',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        category: {
                                            type: 'string',
                                            enum: [
                                                'seeds',
                                                'tools',
                                                'fertilizers',
                                                'containers',
                                                'books',
                                            ],
                                        },
                                        locale: {
                                            type: 'string',
                                            enum: ['hr', 'en'],
                                            default: 'hr',
                                        },
                                        limit: {
                                            type: 'number',
                                            minimum: 1,
                                            maximum: 100,
                                            default: 20,
                                        },
                                    },
                                },
                            },
                            {
                                name: 'commerce-add-to-cart',
                                description: 'Add item to shopping cart',
                                inputSchema: {
                                    type: 'object',
                                    properties: {
                                        userId: {
                                            type: 'string',
                                            description: 'User ID',
                                        },
                                        productId: {
                                            type: 'string',
                                            description: 'Product ID',
                                        },
                                        quantity: {
                                            type: 'number',
                                            minimum: 1,
                                            default: 1,
                                        },
                                        locale: {
                                            type: 'string',
                                            enum: ['hr', 'en'],
                                            default: 'hr',
                                        },
                                    },
                                    required: ['userId', 'productId'],
                                },
                            },
                        ],
                    },
                    id: body.id,
                });

            case 'notifications/initialized':
                // Client has finished initializing - acknowledge
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: null,
                    id: body.id,
                });

            case 'resources/list':
                // Return list of available resources
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        resources: [],
                    },
                    id: body.id,
                });

            case 'resources/templates/list':
                // Return list of available resource templates
                return NextResponse.json({
                    jsonrpc: '2.0',
                    result: {
                        resourceTemplates: [],
                    },
                    id: body.id,
                });

            case 'tools/call': {
                // Redirect to the tools/call endpoint
                const toolsResponse = await fetch(
                    new URL(`${process.env.MCP_BASE_URL}/commerce/tools/call`),
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization:
                                request.headers.get('Authorization') || '',
                        },
                        body: JSON.stringify(body),
                    },
                );

                return new NextResponse(toolsResponse.body, {
                    status: toolsResponse.status,
                    headers: toolsResponse.headers,
                });
            }

            default:
                return NextResponse.json(
                    {
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: `Method not found: ${method}`,
                        },
                        id: body.id,
                    },
                    { status: 400 },
                );
        }
    } catch (error) {
        logger.error('mcp.commerce.error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json(
            {
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal error',
                },
            },
            { status: 500 },
        );
    }
}
