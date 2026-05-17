import { createHash, randomUUID } from 'node:crypto';
import { getUser } from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJwt } from '../../../lib/auth/auth';
import { accountCookieName } from '../../../lib/auth/sessionConfig';
import { resolveMcpAccountId } from '../../../lib/mcp/accountSelection';
import {
    getMcpResources,
    getMcpResourceTemplates,
    getMcpToolCatalogEntry,
    getMcpToolNamesByDomain,
    getMcpTools,
    type McpExposure,
} from './catalog';
import { executeDirectoryTool } from './directories/tools/call/execute';
import { Logger } from './logger';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'] as const;
type SupportedProtocolVersion = (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/api/mcp';
const logger = new Logger('api.mcp.server');
const MAX_MCP_REQUEST_BODY_BYTES = 256 * 1024;
const MCP_TOOL_TIMEOUT_MS = 8_000;

const MCP_SCOPES = {
    read: 'mcp:read',
    write: 'mcp:write',
    admin: 'mcp:admin',
} as const;

const roleToScopes: Record<string, string[]> = {
    user: [MCP_SCOPES.read, MCP_SCOPES.write],
    admin: [MCP_SCOPES.read, MCP_SCOPES.write, MCP_SCOPES.admin],
};

type RateLimitBucket = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitBucket>();

class ToolExecutionTimeoutError extends Error {
    constructor() {
        super('Tool execution timed out');
        this.name = 'ToolExecutionTimeoutError';
    }
}

function checkRateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const bucket = rateLimitStore.get(key);
    if (!bucket || bucket.resetAt <= now) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (bucket.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }

    bucket.count += 1;
    return {
        allowed: true,
        remaining: limit - bucket.count,
        resetAt: bucket.resetAt,
    };
}

function executeWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    ms: number,
) {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return new Promise<T>((resolve, reject) => {
        timeoutId = setTimeout(() => {
            const error = new ToolExecutionTimeoutError();
            controller.abort(error);
            reject(error);
        }, ms);

        operation(controller.signal).then(resolve, reject);
    }).finally(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
}

function safeIdentifier(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function firstHeaderValue(value: string | null) {
    return value?.split(',')[0]?.trim() || null;
}

function lastHeaderValue(value: string | null) {
    return value?.split(',').at(-1)?.trim() || null;
}

function clientAddressForRateLimit(request: NextRequest) {
    return (
        firstHeaderValue(request.headers.get('x-vercel-forwarded-for')) ??
        lastHeaderValue(request.headers.get('x-forwarded-for')) ??
        'unknown'
    );
}

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
    return resolveMcpAccountId(selected, accountIds);
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
    const requestStart = performance.now();
    const correlationId =
        request.headers.get('x-correlation-id') ?? randomUUID();
    const clientAddress = clientAddressForRateLimit(request);

    try {
        const originError = validateOrigin(request);
        if (originError) {
            return originError;
        }

        const contentLengthHeader = request.headers.get('content-length');
        if (
            contentLengthHeader &&
            Number(contentLengthHeader) > MAX_MCP_REQUEST_BODY_BYTES
        ) {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id: null,
                    error: {
                        code: -32600,
                        message: 'Request payload too large',
                    },
                },
                { status: 413, headers: { 'x-correlation-id': correlationId } },
            );
        }

        const body = await request.json();
        const bodySize = new TextEncoder().encode(JSON.stringify(body)).length;
        if (bodySize > MAX_MCP_REQUEST_BODY_BYTES) {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id: body?.id ?? null,
                    error: {
                        code: -32600,
                        message: 'Request payload too large',
                    },
                },
                { status: 413, headers: { 'x-correlation-id': correlationId } },
            );
        }

        const method = body?.method as string | undefined;
        const id = body?.id ?? null;
        const toolName = body?.params?.name as string | undefined;

        const rolloutStage = process.env.MCP_ROLLOUT_STAGE ?? 'all';
        if (method === 'tools/call' && typeof toolName === 'string') {
            const tool = getMcpToolCatalogEntry(toolName);
            if (tool) {
                if (
                    rolloutStage === 'public-read-only' &&
                    tool.exposure !== 'public-read'
                ) {
                    return NextResponse.json(
                        {
                            jsonrpc: '2.0',
                            id,
                            error: {
                                code: -32004,
                                message:
                                    'Tool not enabled in current rollout stage',
                            },
                        },
                        { status: 403 },
                    );
                }
                if (
                    rolloutStage === 'auth-read-only' &&
                    tool.exposure === 'auth-mutation'
                ) {
                    return NextResponse.json(
                        {
                            jsonrpc: '2.0',
                            id,
                            error: {
                                code: -32004,
                                message:
                                    'Tool not enabled in current rollout stage',
                            },
                        },
                        { status: 403 },
                    );
                }
            }
        }

        const rateClass = method === 'tools/call' ? 'tool-call' : 'metadata';
        const rateKey = `${clientAddress}:${rateClass}:${toolName ?? method ?? 'unknown'}`;
        const rate = checkRateLimit(
            rateKey,
            method === 'tools/call' ? 60 : 120,
            60_000,
        );
        if (!rate.allowed) {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32029, message: 'Rate limit exceeded' },
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': Math.ceil(
                            (rate.resetAt - Date.now()) / 1000,
                        ).toString(),
                        'x-correlation-id': correlationId,
                    },
                },
            );
        }

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
                {
                    headers: {
                        'MCP-Protocol-Version': protocolVersion,
                        'x-correlation-id': correlationId,
                    },
                },
            );
        }

        if (method === 'tools/list') {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        tools: getMcpTools(),
                    },
                },
                { headers: { 'x-correlation-id': correlationId } },
            );
        }

        if (method === 'resources/list') {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        resources: await getMcpResources(),
                    },
                },
                { headers: { 'x-correlation-id': correlationId } },
            );
        }

        if (method === 'resources/templates/list') {
            const resources = await getMcpResourceTemplates();
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        resourceTemplates: resources.filter(
                            (resource) => 'uriTemplate' in resource,
                        ),
                    },
                },
                { headers: { 'x-correlation-id': correlationId } },
            );
        }

        if (method === 'prompts/list') {
            return NextResponse.json(
                {
                    jsonrpc: '2.0',
                    id,
                    result: { prompts: [] },
                },
                { headers: { 'x-correlation-id': correlationId } },
            );
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
                    {
                        status: 400,
                        headers: { 'x-correlation-id': correlationId },
                    },
                );
            }

            const tool = getMcpToolCatalogEntry(name);
            if (
                !tool ||
                !getMcpToolNamesByDomain('directories').includes(name)
            ) {
                return NextResponse.json(
                    {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: -32601,
                            message: `Method not found: ${name}`,
                        },
                    },
                    {
                        status: 404,
                        headers: { 'x-correlation-id': correlationId },
                    },
                );
            }

            const requiredScope = requiredScopeForExposure(tool.exposure);
            let authContext: {
                accountId: string;
                role: string;
                userId: string;
            } | null = null;
            if (requiredScope) {
                const auth = await authenticateMcpRequest(
                    request,
                    requiredScope,
                );
                if (!auth.ok) {
                    return auth.response;
                }
                authContext = auth;
            }

            try {
                const result = await executeWithTimeout(
                    (signal) =>
                        executeDirectoryTool(
                            name,
                            body?.params?.arguments ?? {},
                            {
                                signal,
                            },
                        ),
                    MCP_TOOL_TIMEOUT_MS,
                );
                logger.info('mcp.request.success', {
                    correlationId,
                    method,
                    toolName: name,
                    latencyMs: Math.round(performance.now() - requestStart),
                    status: 'success',
                    accountIdHash: safeIdentifier(authContext?.accountId),
                    userIdHash: safeIdentifier(authContext?.userId),
                    role: authContext?.role,
                });
                return NextResponse.json(
                    { jsonrpc: '2.0', id, result },
                    { headers: { 'x-correlation-id': correlationId } },
                );
            } catch (error) {
                const isInvalidParams = error instanceof z.ZodError;
                const isTimeout = error instanceof ToolExecutionTimeoutError;
                logger.error('mcp.request.error', {
                    correlationId,
                    method,
                    toolName: name,
                    latencyMs: Math.round(performance.now() - requestStart),
                    status: 'error',
                    errorType: isInvalidParams
                        ? 'invalid_params'
                        : isTimeout
                          ? 'timeout'
                          : 'tool_failure',
                });
                return NextResponse.json(
                    {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: isInvalidParams ? -32602 : -32603,
                            message: isInvalidParams
                                ? 'Invalid params'
                                : isTimeout
                                  ? 'Tool execution timed out'
                                  : error instanceof Error
                                    ? error.message
                                    : 'Tool execution failed',
                            data: isInvalidParams ? error.issues : undefined,
                        },
                    },
                    {
                        status: isInvalidParams ? 400 : isTimeout ? 504 : 500,
                        headers: { 'x-correlation-id': correlationId },
                    },
                );
            }
        }

        return NextResponse.json(
            {
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Method not found: ${method}` },
            },
            { status: 400, headers: { 'x-correlation-id': correlationId } },
        );
    } finally {
        logger.info('mcp.request.complete', {
            correlationId,
            latencyMs: Math.round(performance.now() - requestStart),
            path: '/api/mcp',
            clientIpHash: safeIdentifier(clientAddress),
        });
    }
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
