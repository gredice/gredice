import { enablePublicEnvironmentDebugFlag } from '../../../flags';

export async function GET() {
    return Response.json(
        { enabled: await enablePublicEnvironmentDebugFlag() },
        { headers: { 'Cache-Control': 'private, no-store' } },
    );
}
