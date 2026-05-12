import { getEntitiesFormatted } from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'] as const;
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

const GetPlantsSchema = z.object({
    limit: z.number().min(1).max(1000).default(100),
    offset: z.number().min(0).default(0),
    category: z.string().optional(),
});

export async function handleMcpRequest(request: NextRequest) {
    const body = await request.json();
    const method = body?.method as string | undefined;
    const id = body?.id ?? null;

    if (method === 'initialize') {
        const clientVersion = body?.params?.protocolVersion as
            | string
            | undefined;
        const protocolVersion: string =
            clientVersion &&
            SUPPORTED_PROTOCOL_VERSIONS.includes(clientVersion as never)
                ? clientVersion
                : DEFAULT_PROTOCOL_VERSION;

        return NextResponse.json(
            {
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion,
                    capabilities: {
                        tools: { listChanged: false },
                        resources: {},
                        prompts: {},
                    },
                    serverInfo: { name: 'gredice-mcp', version: '1.0.0' },
                },
            },
            { headers: { 'MCP-Protocol-Version': protocolVersion } },
        );
    }

    if (method === 'tools/list') {
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
                tools: [
                    {
                        name: 'directories/get-plants',
                        description:
                            'Get Croatian plant catalog with attributes and calendar data',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                limit: { type: 'number' },
                                offset: { type: 'number' },
                                category: { type: 'string' },
                            },
                        },
                    },
                ],
            },
        });
    }

    if (method === 'resources/list') {
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: { resources: [] },
        });
    }

    if (method === 'resources/templates/list') {
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: { resourceTemplates: [] },
        });
    }

    if (method === 'prompts/list') {
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: { prompts: [] },
        });
    }

    if (method === 'tools/call') {
        const name = body?.params?.name as string;
        if (name !== 'directories/get-plants') {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${name}`,
                    },
                },
                { status: 404 },
            );
        }
        const input = GetPlantsSchema.parse(body?.params?.arguments ?? {});
        const allPlants =
            (await getEntitiesFormatted<Record<string, unknown>>('plant')) ||
            [];
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
                plants: allPlants.slice(
                    input.offset,
                    input.offset + input.limit,
                ),
                total: allPlants.length,
            },
        });
    }

    return NextResponse.json(
        {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
        },
        { status: 400 },
    );
}
