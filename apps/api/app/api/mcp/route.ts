import type { NextRequest } from 'next/server';
import {
    isMcpPublicAccessEnabled,
    mcpPublicDocumentationUrl,
} from '../../../lib/mcp/publicAccess';
import { handleMcpRequest } from './server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    return handleMcpRequest(request);
}

export async function GET() {
    if (!isMcpPublicAccessEnabled()) {
        return Response.json(
            { error: 'Not found' },
            {
                status: 404,
                headers: { 'Cache-Control': 'private, no-store' },
            },
        );
    }

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
