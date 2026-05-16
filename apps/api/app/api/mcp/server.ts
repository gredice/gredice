import { getUser } from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJwt } from '../../../lib/auth/auth';
import { accountCookieName } from '../../../lib/auth/sessionConfig';
import {
    getMcpResources,
    getMcpResourceTemplates,
    getMcpToolCatalogEntry,
    getMcpToolNamesByDomain,
    getMcpTools,
    type McpExposure,
} from './catalog';
import { executeDirectoryTool } from './directories/tools/call/execute';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'] as const;
type SupportedProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/api/mcp';

const MCP_SCOPES = {
    read: 'mcp:read',
    write: 'mcp:write',
    admin: 'mcp:admin',
} as const;

const roleToScopes: Record<string, string[]> = {
    user: [MCP_SCOPES.read, MCP_SCOPES.write],
    admin: [MCP_SCOPES.read, MCP_SCOPES.write, MCP_SCOPES.admin],
};

function isSupportedProtocolVersion(
    version: string | undefined,
): version is SupportedProtocolVersion {
    return SUPPORTED_PROTOCOL_VERSIONS.some(
        (supportedVersion) => supportedVersion === version,
    );
}

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

function requiredScopeForExposure(exposure: McpExposure) {
    switch (exposure) {
        case 'public-read':
            return null;
        case 'auth-read':
            return MCP_SCOPES.read;
        case 'auth-mutation':
            return MCP_SCOPES.write;
        case 'admin-internal':
        case 'excluded':
            return MCP_SCOPES.admin;
    }
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

    const verified = await verifyJwt(token).catch(() => null);
    if (!verified) {
        return { ok: false as const, response: unauthorizedResponse(request) };
    }

    const { result, error } = verified;
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

    const body = await request.json();
    const method = body?.method as string | undefined;
    const id = body?.id ?? null;

    if (method === 'initialize') {
        const clientVersion = body?.params?.protocolVersion as
            | string
            | undefined;
        const protocolVersion = isSupportedProtocolVersion(clientVersion)
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
                tools: getMcpTools(),
            },
        });
    }

    if (method === 'resources/list') {
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
                resources: await getMcpResources(),
            },
        });
    }

    if (method === 'resources/templates/list') {
        const resources = await getMcpResourceTemplates();
        return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
                resourceTemplates: resources.filter(
                    (resource) => 'uriTemplate' in resource,
                ),
            },
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
        const name = body?.params?.name;
        if (typeof name !== 'string') {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32602,
                        message: 'Tool name is required',
                    },
                },
                { status: 400 },
            );
        }

        const tool = getMcpToolCatalogEntry(name);
        if (!tool || !getMcpToolNamesByDomain('directories').includes(name)) {
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

        const requiredScope = requiredScopeForExposure(tool.exposure);
        if (requiredScope) {
            const auth = await authenticateMcpRequest(request, requiredScope);
            if (!auth.ok) {
                return auth.response;
            }
        }

        try {
            const result = await executeDirectoryTool(
                name,
                body?.params?.arguments ?? {},
            );
            return NextResponse.json({
                jsonrpc: '2.0',
                id,
                result,
            });
        } catch (error) {
            const isInvalidParams = error instanceof z.ZodError;
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: isInvalidParams ? -32602 : -32603,
                        message: isInvalidParams
                            ? 'Invalid params'
                            : error instanceof Error
                              ? error.message
                              : 'Tool execution failed',
                        data: isInvalidParams ? error.issues : undefined,
                    },
                },
                { status: isInvalidParams ? 400 : 500 },
            );
        }
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
        resource_documentation: `${baseUrlFromRequest(request)}/test`,
        scopes_supported: [MCP_SCOPES.read, MCP_SCOPES.write, MCP_SCOPES.admin],
    });
}
