'use server';

import { getRaisedBed, updateRaisedBed } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

const raisedBedStatuses = ['new', 'approved', 'built', 'active'] as const;

type RaisedBedStatusValue = (typeof raisedBedStatuses)[number];

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

export async function setRaisedBedStatus(
    raisedBedId: number,
    status: RaisedBedStatusValue,
) {
    await auth(['admin']);

    if (!raisedBedStatuses.includes(status)) {
        throw new Error(`Invalid raised bed status: ${status}`);
    }

    const raisedBed = await getRaisedBed(raisedBedId);

    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    if (raisedBed.status === status) {
        return;
    }

    await updateRaisedBed({
        id: raisedBedId,
        status,
    });

    revalidatePath(KnownPages.RaisedBed(raisedBedId));
    revalidatePath(KnownPages.RaisedBeds);

    if (raisedBed.accountId) {
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    }

    if (raisedBed.gardenId) {
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    }

    revalidatePath(KnownPages.Sensors);
}
