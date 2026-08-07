import type { NextRequest } from 'next/server';
import { mcpPublicDocumentationUrl } from '../../../lib/mcp/publicMetadata';
import { handleMcpRequest } from './server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    return handleMcpRequest(request);
}

export async function GET() {
    return Response.json({
        name: 'gredice-mcp',
        endpoint: '/api/mcp',
        documentation: mcpPublicDocumentationUrl,
        developerConsole: '/test',
        protectedResourceMetadata:
            '/.well-known/oauth-protected-resource/api/mcp',
        transport: 'streamable-http',
    });
}
