import type { NextRequest } from 'next/server';
import { handleOutletLifecycleCron } from '../../../../../lib/stripe/outletLifecycleCron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export function GET(request: NextRequest) {
    return handleOutletLifecycleCron(request);
}
