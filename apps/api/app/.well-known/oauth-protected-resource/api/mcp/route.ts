import type { NextRequest } from 'next/server';
import { getProtectedResourceMetadata } from '../../../../api/mcp/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    return getProtectedResourceMetadata(request);
}
