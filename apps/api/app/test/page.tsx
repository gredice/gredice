import type { Metadata } from 'next';
import Link from 'next/link';
import {
    getMcpResourceCatalog,
    getMcpToolCatalog,
    type McpExposure,
    type McpToolCatalogEntry,
} from '../api/mcp/catalog';
import { type McpConsoleRequest, McpTestConsole } from './McpTestConsole';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Gredice MCP Test Console',
    description: 'MCP endpoint documentation and safe JSON-RPC test console.',
};

const exposureDetails: Record<
    McpExposure,
    { label: string; scope: string; description: string }
> = {
    'public-read': {
        label: 'Public read',
        scope: 'None',
        description:
            'Read-only catalog data that can be called without a token.',
    },
    'auth-read': {
        label: 'Authenticated read',
        scope: 'mcp:read',
        description:
            'Read-only calls that require a valid Gredice API bearer token.',
    },
    'auth-mutation': {
        label: 'Mutating',
        scope: 'mcp:write',
        description: 'State-changing calls that require write scope.',
    },
    'admin-internal': {
        label: 'Admin/internal',
        scope: 'mcp:admin',
        description: 'Administrative operations for internal tooling.',
    },
    excluded: {
        label: 'Excluded',
        scope: 'Unavailable',
        description: 'Registry entries that are not published.',
    },
};

const documentedExposures: McpExposure[] = [
    'public-read',
    'auth-read',
    'auth-mutation',
    'admin-internal',
];

function sampleArguments(toolName: string): Record<string, unknown> {
    switch (toolName) {
        case 'directories/get-plants':
            return { limit: 2, offset: 0 };
        case 'directories/get-plant':
            return { plantName: 'rajcica', includeSorts: false };
        case 'directories/get-plant-sorts':
            return { plant_type: 'rajcica', limit: 2, offset: 0 };
        case 'directories/search-entities':
            return { query: 'rajcica', limit: 3 };
        case 'directories/get-operations':
            return { category: 'sadnja', limit: 2, offset: 0 };
        case 'directories/get-seeds':
            return { plant_type: 'rajcica', limit: 2, offset: 0 };
        default:
            return {};
    }
}

function toolCallRequest({
    key,
    label,
    tool,
}: {
    key: string;
    label: string;
    tool: McpToolCatalogEntry;
}): McpConsoleRequest {
    return {
        key,
        label,
        description: tool.description,
        requiresAuth: tool.exposure !== 'public-read',
        payload: {
            jsonrpc: '2.0',
            id: key,
            method: 'tools/call',
            params: {
                name: tool.name,
                arguments: sampleArguments(tool.name),
            },
        },
    };
}

function testRequests(tools: McpToolCatalogEntry[]) {
    const requests: McpConsoleRequest[] = [
        {
            key: 'initialize',
            label: 'initialize',
            description: 'Negotiate protocol version and server capabilities.',
            requiresAuth: false,
            payload: {
                jsonrpc: '2.0',
                id: 'initialize',
                method: 'initialize',
                params: {
                    protocolVersion: '2025-03-26',
                    capabilities: {},
                    clientInfo: {
                        name: 'gredice-api-console',
                        version: '1.0.0',
                    },
                },
            },
        },
        {
            key: 'tools-list',
            label: 'tools/list',
            description: 'Return the current MCP tool catalog.',
            requiresAuth: false,
            payload: {
                jsonrpc: '2.0',
                id: 'tools-list',
                method: 'tools/list',
                params: {},
            },
        },
    ];

    const publicReadTool = tools.find(
        (tool) => tool.exposure === 'public-read',
    );
    if (publicReadTool) {
        requests.push(
            toolCallRequest({
                key: 'public-read-tool',
                label: 'public read tool',
                tool: publicReadTool,
            }),
        );
    }

    const authReadTool = tools.find((tool) => tool.exposure === 'auth-read');
    if (authReadTool) {
        requests.push(
            toolCallRequest({
                key: 'auth-read-tool',
                label: 'authenticated read tool',
                tool: authReadTool,
            }),
        );
    }

    return requests;
}

function resourceAddress(
    resource: ReturnType<typeof getMcpResourceCatalog>[number],
) {
    return 'uri' in resource ? resource.uri : resource.uriTemplate;
}

export default function McpTestPage() {
    const tools = getMcpToolCatalog();
    const resources = getMcpResourceCatalog().filter(
        (resource) => resource.exposure !== 'excluded',
    );
    const requests = testRequests(tools);

    return (
        <main className="w-full">
            <section className="border-b border-border bg-background">
                <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div>
                        <p className="text-sm font-medium uppercase tracking-wide text-primary">
                            Model Context Protocol
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
                            Gredice MCP docs and test console
                        </h1>
                        <p className="mt-3 max-w-3xl text-base text-muted-foreground">
                            The API app publishes one Streamable HTTP MCP
                            endpoint at <code>/api/mcp</code>. This page uses
                            the same MCP registry as the server, so tool and
                            resource lists stay aligned with the implementation.
                        </p>
                    </div>
                    <div className="grid content-start gap-2 text-sm">
                        <Link
                            className="rounded-md border border-border bg-card px-3 py-2 font-mono hover:bg-secondary"
                            href="/api/mcp"
                        >
                            GET /api/mcp
                        </Link>
                        <Link
                            className="rounded-md border border-border bg-card px-3 py-2 font-mono hover:bg-secondary"
                            href="/.well-known/oauth-protected-resource/api/mcp"
                        >
                            OAuth resource metadata
                        </Link>
                    </div>
                </div>
            </section>

            <section className="border-b border-border">
                <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-3">
                    <div className="rounded-md border border-border bg-card p-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Production
                        </h2>
                        <p className="mt-2 break-words font-mono text-sm">
                            https://api.gredice.com/api/mcp
                        </p>
                    </div>
                    <div className="rounded-md border border-border bg-card p-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Local
                        </h2>
                        <p className="mt-2 break-words font-mono text-sm">
                            https://api.gredice.test/api/mcp
                        </p>
                    </div>
                    <div className="rounded-md border border-border bg-card p-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Transport
                        </h2>
                        <p className="mt-2 text-sm">
                            JSON-RPC 2.0 over Streamable HTTP with optional
                            bearer authentication per tool.
                        </p>
                    </div>
                </div>
            </section>

            <section className="border-b border-border bg-muted/35">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold">
                                Test console
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Run safe discovery calls, one public read tool,
                                and one authenticated read tool against the
                                current host.
                            </p>
                        </div>
                    </div>
                    <McpTestConsole requests={requests} />
                </div>
            </section>

            <section className="border-b border-border">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <h2 className="text-xl font-semibold">Tool catalog</h2>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {documentedExposures.map((exposure) => {
                            const details = exposureDetails[exposure];
                            const publishedTools = tools.filter(
                                (tool) => tool.exposure === exposure,
                            );

                            return (
                                <div
                                    className="rounded-md border border-border bg-card p-4"
                                    key={exposure}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <h3 className="font-semibold">
                                                {details.label}
                                            </h3>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {details.description}
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs">
                                            {details.scope}
                                        </span>
                                    </div>
                                    {publishedTools.length > 0 ? (
                                        <div className="mt-4 grid gap-2">
                                            {publishedTools.map((tool) => (
                                                <div
                                                    className="rounded-md border border-border bg-background p-3"
                                                    key={tool.name}
                                                >
                                                    <div className="font-mono text-sm font-medium">
                                                        {tool.name}
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {tool.description}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-4 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                                            No tools are currently published in
                                            this bucket.
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="border-b border-border bg-muted/35">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <h2 className="text-xl font-semibold">Resource catalog</h2>
                    <div className="mt-4 grid gap-3">
                        {resources.map((resource) => (
                            <div
                                className="rounded-md border border-border bg-card p-4"
                                key={resource.name}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <div className="font-mono text-sm font-medium">
                                            {resourceAddress(resource)}
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {resource.description}
                                        </p>
                                    </div>
                                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs">
                                        {
                                            exposureDetails[resource.exposure]
                                                .scope
                                        }
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section>
                <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-2">
                    <div>
                        <h2 className="text-xl font-semibold">
                            Local credentials
                        </h2>
                        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                            <p>
                                Public read calls do not need credentials.
                                Authenticated read calls use the same bearer JWT
                                format as the API session cookie named{' '}
                                <code>gredice_session</code>.
                            </p>
                            <p>
                                For local token testing, keep secrets in
                                <code> apps/api/.env.local</code>. Generate a
                                base64 signing secret, set
                                <code> GREDICE_JWT_SIGN_SECRET</code>, then mint
                                an account-bound token for a local user and
                                account that exist in the development database.
                            </p>
                        </div>
                        <pre className="mt-4 overflow-auto rounded-md border border-border bg-slate-950 p-3 text-xs leading-relaxed text-slate-50">
                            <code>{`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"

cd apps/api
GREDICE_TEST_USER_ID=user_id GREDICE_TEST_ACCOUNT_ID=account_id \\
node --conditions=react-server --env-file=.env.local --import tsx -e "import { createJwt } from './lib/auth/auth.ts'; const sub = process.env.GREDICE_TEST_USER_ID; const accountId = process.env.GREDICE_TEST_ACCOUNT_ID; if (!sub || !accountId) throw new Error('Missing test ids'); console.log(await createJwt({ sub, accountId }, '72h'));"`}</code>
                        </pre>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold">Auth errors</h2>
                        <div className="mt-3 grid gap-3">
                            <div className="rounded-md border border-border bg-card p-4">
                                <div className="font-mono text-sm">
                                    401 Unauthorized
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Missing, empty, expired, or invalid bearer
                                    token. The response includes a
                                    <code> WWW-Authenticate</code> header with
                                    the OAuth protected resource metadata URL.
                                </p>
                                <pre className="mt-3 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50">
                                    <code>{`{
  "jsonrpc": "2.0",
  "id": null,
  "error": { "code": -32000, "message": "Unauthorized" }
}`}</code>
                                </pre>
                            </div>
                            <div className="rounded-md border border-border bg-card p-4">
                                <div className="font-mono text-sm">
                                    403 Forbidden
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Valid token, but the user role does not
                                    grant the required scope. Current published
                                    scopes are <code>mcp:read</code>,{' '}
                                    <code>mcp:write</code>, and{' '}
                                    <code>mcp:admin</code>.
                                </p>
                                <pre className="mt-3 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50">
                                    <code>{`{
  "jsonrpc": "2.0",
  "id": null,
  "error": { "code": -32001, "message": "Insufficient scope" }
}`}</code>
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
