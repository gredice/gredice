'use server';

import {
    type HarvestTraceLinkStatus,
    updateHarvestTraceLinkStatus,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

const validStatuses = new Set<HarvestTraceLinkStatus>(['active', 'revoked']);

function parseHarvestTraceStatus(value: string) {
    if (value === 'active' || value === 'revoked') {
        return value satisfies HarvestTraceLinkStatus;
    }

    return null;
}

export async function updateHarvestTraceStatusAction(formData: FormData) {
    await auth(['admin']);

    const traceId = Number.parseInt(String(formData.get('traceId') ?? ''), 10);
    const status = parseHarvestTraceStatus(
        String(formData.get('status') ?? ''),
    );

    if (!Number.isInteger(traceId) || traceId <= 0) {
        throw new Error('Neispravan QR trag.');
    }

    if (!status || !validStatuses.has(status)) {
        throw new Error('Neispravan status QR traga.');
    }

    await updateHarvestTraceLinkStatus(traceId, status);
    revalidatePath(KnownPages.HarvestTraces);
    revalidatePath(KnownPages.HarvestTrace(traceId));
}
