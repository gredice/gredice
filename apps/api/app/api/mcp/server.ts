import { getEntitiesFormatted, getUser } from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJwt } from '../../../lib/auth/auth';
import { accountCookieName } from '../../../lib/auth/sessionConfig';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'] as const;
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const PROTECTED_RESOURCE_PATH = '/api/mcp/.well-known/oauth-protected-resource';

const MCP_SCOPES = {
    read: 'mcp:read',
    write: 'mcp:write',
    admin: 'mcp:admin',
} as const;

const roleToScopes: Record<string, string[]> = {
    user: [MCP_SCOPES.read, MCP_SCOPES.write],
    admin: [MCP_SCOPES.read, MCP_SCOPES.write, MCP_SCOPES.admin],
};

const GetPlantsSchema = z.object({
    limit: z.number().min(1).max(1000).default(100),
    offset: z.number().min(0).default(0),
    category: z.string().optional(),
});

function baseUrlFromRequest(request: NextRequest) {
    return new URL(request.url).origin;
}

function buildChallenge(request: NextRequest, error = 'invalid_token') {
    const metadataUrl = `${baseUrlFromRequest(request)}${PROTECTED_RESOURCE_PATH}`;
    return `Bearer realm="gredice-mcp", error="${error}", scope="${MCP_SCOPES.read}", resource_metadata="${metadataUrl}"`;
}

function forbiddenResponse(message: string) {
    return NextResponse.json(
        { jsonrpc: '2.0', id: null, error: { code: -32001, message } },
        { status: 403 },
    );
}

function unauthorizedResponse(request: NextRequest) {
    return NextResponse.json(
        {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32000, message: 'Unauthorized' },
        },
        {
            status: 401,
            headers: { 'WWW-Authenticate': buildChallenge(request) },
        },
    );
}

function resolveAllowedOrigins() {
    const parsed = (process.env.MCP_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return new Set(parsed);
}

function resolveAccountId(request: NextRequest, accountIds: string[]) {
    const selected =
        request.headers.get('x-gredice-account-id') ??
        request.cookies.get(accountCookieName)?.value;
    if (selected && accountIds.includes(selected)) {
        return selected;
    }
    return accountIds[0];
}

async function authenticateMcpRequest(
    request: NextRequest,
    requiredScope: string,
) {
    const authorizationHeader = request.headers.get('authorization');
    if (!authorizationHeader?.toLowerCase().startsWith('bearer ')) {
        return { ok: false as const, response: unauthorizedResponse(request) };
    }

    const token = authorizationHeader.slice(7).trim();
    if (!token) {
        return { ok: false as const, response: unauthorizedResponse(request) };
    }

    const { result, error } = await verifyJwt(token);
    if (
        error ||
        !result?.payload?.sub ||
        typeof result.payload.sub !== 'string'
    ) {
        return { ok: false as const, response: unauthorizedResponse(request) };
    }

    const dbUser = await getUser(result.payload.sub);
    if (!dbUser) {
        return { ok: false as const, response: unauthorizedResponse(request) };
    }

    const scopes = roleToScopes[dbUser.role] ?? [];
    if (!scopes.includes(requiredScope)) {
        return {
            ok: false as const,
            response: forbiddenResponse('Insufficient scope'),
        };
    }

    const accountIds = dbUser.accounts.map((account) => account.accountId);
    const accountId = resolveAccountId(request, accountIds);
    if (!accountId) {
        return {
            ok: false as const,
            response: forbiddenResponse('No authorized account selected'),
        };
    }

    return {
        ok: true as const,
        userId: dbUser.id,
        role: dbUser.role,
        accountId,
    };
}

function validateOrigin(request: NextRequest) {
    const origin = request.headers.get('origin');
    if (!origin) {
        return null;
    }

    const allowed = resolveAllowedOrigins();
    if (allowed.size === 0 || allowed.has(origin)) {
        return null;
    }

    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
}

export async function handleMcpRequest(request: NextRequest) {
    const originError = validateOrigin(request);
    if (originError) {
        return originError;
    }

    const auth = await authenticateMcpRequest(request, MCP_SCOPES.read);
    if (!auth.ok) {
        return auth.response;
    }

    const body = await request.json();
    const method = body?.method as string | undefined;
    const id = body?.id ?? null;

    if (method === 'initialize') {
        const clientVersion = body?.params?.protocolVersion as
            | string
            | undefined;
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(
            clientVersion as never,
        )
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

export function getProtectedResourceMetadata(request: NextRequest) {
    const resource = `${baseUrlFromRequest(request)}/api/mcp`;
    const issuer = process.env.AUTH_ISSUER_URL ?? baseUrlFromRequest(request);

    return NextResponse.json({
        resource,
        authorization_servers: [issuer],
        bearer_methods_supported: ['header'],
        resource_documentation: 'https://api.gredice.com/docs/mcp',
        scopes_supported: [MCP_SCOPES.read, MCP_SCOPES.write, MCP_SCOPES.admin],
    });
}
