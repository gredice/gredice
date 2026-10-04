import type { NextRequest } from 'next/server';
import { handleGardenPreviewBlobDeletionCron } from '../../../../../lib/garden/gardenPreviewBlobDeletionCron';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
    return handleGardenPreviewBlobDeletionCron(request);
}
