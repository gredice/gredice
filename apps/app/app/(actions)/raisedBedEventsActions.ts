'use server';

import { deleteEventById } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function deleteRaisedBedEventAction(
    eventId: number,
    raisedBedId: number,
) {
    await auth(['admin']);

    await deleteEventById(eventId);

    revalidatePath(KnownPages.RaisedBed(raisedBedId));

    return { success: true } as const;
}
