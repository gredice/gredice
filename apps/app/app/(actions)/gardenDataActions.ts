'use server';

import { getRaisedBedFieldsWithEvents, getRaisedBeds } from '@gredice/storage';
import { auth } from '../../lib/auth/auth';

export async function getGardenRaisedBeds(
    gardenId: number,
    accountId?: string,
) {
    await auth(['admin']);

    if (!gardenId) {
        throw new Error('Garden ID is required');
    }

    // Get all raised beds for the garden
    const raisedBeds = await getRaisedBeds(gardenId);

    // Filter by accountId if provided
    if (accountId) {
        return raisedBeds.filter((bed) => bed.accountId === accountId);
    }

    return raisedBeds;
}

export async function getRaisedBedFields(raisedBedId: number) {
    await auth(['admin']);

    if (!raisedBedId) {
        throw new Error('Raised bed ID is required');
    }

    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    return fields;
}
