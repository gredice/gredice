export const dynamic = 'force-dynamic';

export function GET() {
    return Response.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'gredice-mcp-core',
    });
}
