import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint = new URL(
    process.env.MCP_SMOKE_URL ?? 'https://api.gredice.com/api/mcp',
);
const protectedResourceMetadata = new URL(
    '/.well-known/oauth-protected-resource/api/mcp',
    endpoint,
);

function invariant(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function readJson(response, label) {
    const text = await response.text();
    invariant(
        response.ok,
        `${label} returned HTTP ${response.status}: ${text}`,
    );

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${label} did not return valid JSON`);
    }
}

async function verifyEndpointMetadata() {
    const metadata = await readJson(await fetch(endpoint), 'MCP endpoint');
    invariant(metadata.endpoint === '/api/mcp', 'Unexpected MCP endpoint path');
    invariant(
        metadata.transport === 'streamable-http',
        'Unexpected MCP transport',
    );
}

async function verifyProtectedResourceMetadata() {
    const metadata = await readJson(
        await fetch(protectedResourceMetadata),
        'Protected-resource metadata',
    );
    invariant(
        metadata.resource === endpoint.toString(),
        'Protected-resource metadata has an unexpected resource URL',
    );
    for (const scope of ['mcp:read', 'mcp:write', 'mcp:admin']) {
        invariant(
            metadata.scopes_supported?.includes(scope),
            `Protected-resource metadata is missing ${scope}`,
        );
    }
}

async function verifyProtectedToolChallenge() {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'anonymous-garden-read',
            method: 'tools/call',
            params: {
                name: 'gardens/list-gardens',
                arguments: { limit: 1, offset: 0 },
            },
        }),
    });
    const challenge = response.headers.get('www-authenticate') ?? '';
    invariant(
        response.status === 401,
        'Anonymous garden read was not rejected',
    );
    invariant(
        challenge.includes(protectedResourceMetadata.pathname),
        'Authentication challenge is missing protected-resource metadata',
    );
    invariant(
        challenge.includes('scope="mcp:read"'),
        'Authentication challenge is missing mcp:read',
    );
}

function verifyToolResult(result, toolName) {
    invariant(
        Array.isArray(result.content) &&
            result.content.some(
                (item) => item.type === 'text' && typeof item.text === 'string',
            ),
        `${toolName} is missing model-visible text content`,
    );
    invariant(
        result.structuredContent &&
            typeof result.structuredContent === 'object',
        `${toolName} is missing structuredContent`,
    );
}

async function verifyOfficialClient() {
    const client = new Client(
        { name: 'gredice-public-smoke', version: '1.0.0' },
        { capabilities: {} },
    );
    const transport = new StreamableHTTPClientTransport(endpoint);

    try {
        await client.connect(transport);
        const tools = await client.listTools();
        const toolNames = new Set(tools.tools.map((tool) => tool.name));
        for (const toolName of [
            'directories/get-plants',
            'commerce/get-products',
            'gardens/list-gardens',
            'commerce/get-cart',
        ]) {
            invariant(
                toolNames.has(toolName),
                `Tool catalog is missing ${toolName}`,
            );
        }

        const plants = await client.callTool({
            name: 'directories/get-plants',
            arguments: { limit: 1, offset: 0 },
        });
        verifyToolResult(plants, 'directories/get-plants');

        const products = await client.callTool({
            name: 'commerce/get-products',
            arguments: { limit: 1, offset: 0 },
        });
        verifyToolResult(products, 'commerce/get-products');
    } finally {
        await client.close();
    }
}

await verifyEndpointMetadata();
await verifyProtectedResourceMetadata();
await verifyOfficialClient();
await verifyProtectedToolChallenge();

console.log(`Public MCP smoke passed: ${endpoint.toString()}`);
