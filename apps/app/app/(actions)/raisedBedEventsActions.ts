'use server';

import {
    deleteEventById,
    deleteRaisedBedFieldEventById,
    getEventById,
    RaisedBedFieldEventMutationError,
    updateEventCreatedAt,
    updateRaisedBedFieldEventCreatedAt,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import { runRaisedBedEventMutation } from '../../src/raisedBedEventMutationPolicy';

function mutationActionResult(
    result: Awaited<ReturnType<typeof runRaisedBedEventMutation>>,
) {
    return result.allowed
        ? ({ success: true } as const)
        : ({ success: false, error: result.reason } as const);
}

export async function deleteRaisedBedEventAction(
    eventId: number,
    raisedBedId: number,
) {
    await auth(['admin']);

    let result: Awaited<ReturnType<typeof runRaisedBedEventMutation>>;
    try {
        result = await runRaisedBedEventMutation({
            eventId,
            raisedBedId,
            getEvent: getEventById,
            mutate: (event) =>
                event.type.startsWith('raisedBedField.')
                    ? deleteRaisedBedFieldEventById(eventId)
                    : deleteEventById(eventId),
        });
    } catch (error) {
        if (error instanceof RaisedBedFieldEventMutationError) {
            return { success: false, error: error.code } as const;
        }
        throw error;
    }
    if (!result.allowed) {
        return mutationActionResult(result);
    }

    revalidatePath(KnownPages.RaisedBed(raisedBedId));

    return mutationActionResult(result);
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

    let result: Awaited<ReturnType<typeof runRaisedBedEventMutation>>;
    try {
        result = await runRaisedBedEventMutation({
            eventId,
            raisedBedId,
            getEvent: getEventById,
            mutate: (event) =>
                event.type.startsWith('raisedBedField.')
                    ? updateRaisedBedFieldEventCreatedAt(eventId, parsed)
                    : updateEventCreatedAt(eventId, parsed),
        });
    } catch (error) {
        if (error instanceof RaisedBedFieldEventMutationError) {
            return { success: false, error: error.code } as const;
        }
        throw error;
    }
    if (!result.allowed) {
        return mutationActionResult(result);
    }

    revalidatePath(KnownPages.RaisedBed(raisedBedId));

    return mutationActionResult(result);
}
