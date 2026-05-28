'use server';

import { deleteEventById, updateEventCreatedAt } from '@gredice/storage';
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

export async function updateRaisedBedEventDateAction(
    eventId: number,
    raisedBedId: number,
    createdAt: string,
) {
    await auth(['admin']);

    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) {
        return { success: false, error: 'invalid_date' } as const;
    }

    await updateEventCreatedAt(eventId, parsed);

    revalidatePath(KnownPages.RaisedBed(raisedBedId));

    return { success: true } as const;
}
