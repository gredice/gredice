'use server';

import {
    correctLegacyRaisedBedPlantSort,
    correctSelectedRaisedBedPlantingSort,
    getRaisedBed,
    getRaisedBedPlanting,
    type LegacyPlantSortCorrectionIdentity,
    type SelectedRaisedBedPlantingTaskCommandIdentity,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function correctRaisedBedPlantSortAction(
    identity:
        | LegacyPlantSortCorrectionIdentity
        | SelectedRaisedBedPlantingTaskCommandIdentity,
    plantSortId: number,
    commandId: string,
) {
    const { userId } = await auth(['admin']);
    let raisedBedId: number;
    if (identity.kind === 'selected') {
        await correctSelectedRaisedBedPlantingSort({
            ...identity,
            plantSortId,
            commandId,
            actor: { role: 'admin', userId },
        });
        const planting = await getRaisedBedPlanting(identity.plantingId);
        if (!planting) throw new Error('Sadnja nije pronađena.');
        raisedBedId = planting.raisedBedId;
    } else if (identity.kind === 'legacy') {
        await correctLegacyRaisedBedPlantSort({
            ...identity,
            plantSortId,
            actor: { role: 'admin', userId },
        });
        raisedBedId = identity.raisedBedId;
    } else {
        throw new Error('Podaci o sadnji nisu ispravni.');
    }
    const bed = await getRaisedBed(raisedBedId);
    revalidatePath(KnownPages.Schedule);
    revalidatePath(KnownPages.Greenhouse);
    revalidatePath(KnownPages.RaisedBeds);
    revalidatePath(KnownPages.RaisedBed(raisedBedId));
    if (bed?.accountId) revalidatePath(KnownPages.Account(bed.accountId));
    if (bed?.gardenId) revalidatePath(KnownPages.Garden(bed.gardenId));
    return { success: true };
}
