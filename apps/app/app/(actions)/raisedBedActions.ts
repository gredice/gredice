'use server';

import { updateRaisedBed } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function setRaisedBedPhysicalId(
    raisedBedId: number,
    physicalId: string | null,
) {
    await auth(['admin']);

    await updateRaisedBed({
        id: raisedBedId,
        physicalId,
    });

    revalidatePath(KnownPages.RaisedBed(raisedBedId));
    revalidatePath(KnownPages.Schedule);
}
