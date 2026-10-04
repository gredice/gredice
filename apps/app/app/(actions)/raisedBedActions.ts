'use server';

import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDON_OPERATION_ENTITY_ID,
    RAISED_BED_OPERATION_ENTITY_TYPE_NAME,
} from '@gredice/js/raisedBeds';
import {
    abandonRaisedBed,
    getRaisedBed,
    mergeRaisedBeds,
    type RaisedBedWeedStateLevel,
    setRaisedBedWeedState as setRaisedBedWeedStateInStorage,
    updateRaisedBed,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import type { RaisedBedStatusValue } from '../admin/raised-beds/[raisedBedId]/RaisedBedStatusItems';

export type AbandonRaisedBedActionState = {
    success: boolean;
    message: string;
};

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

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    // Ignore if unchanged
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

export async function setRaisedBedWeedState(
    raisedBedId: number,
    level: RaisedBedWeedStateLevel,
) {
    await auth(['admin']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    if (raisedBed.weedState?.level === level) {
        return;
    }

    await setRaisedBedWeedStateInStorage({
        level,
        raisedBedId,
        source: 'admin',
    });

    revalidatePath(KnownPages.RaisedBed(raisedBedId));
    revalidatePath(KnownPages.RaisedBeds);

    if (raisedBed.accountId) {
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    }

    if (raisedBed.gardenId) {
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    }
}

export async function abandonRaisedBedDueToInactivityAction(
    raisedBedId: number,
): Promise<AbandonRaisedBedActionState> {
    await auth(['admin']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        return {
            success: false,
            message: `Gredica s ID-em ${raisedBedId} nije pronađena.`,
        };
    }

    if (isRaisedBedAbandoned(raisedBed.status)) {
        return {
            success: true,
            message: 'Gredica je već označena kao napuštena.',
        };
    }

    if (!raisedBed.accountId || !raisedBed.gardenId) {
        return {
            success: false,
            message:
                'Gredica mora biti povezana s računom i vrtom prije napuštanja.',
        };
    }

    await abandonRaisedBed({
        accountId: raisedBed.accountId,
        gardenId: raisedBed.gardenId,
        operationEntityId: RAISED_BED_ABANDON_OPERATION_ENTITY_ID,
        operationEntityTypeName: RAISED_BED_OPERATION_ENTITY_TYPE_NAME,
        raisedBedId,
        reason: 'inactivity',
    });

    revalidatePath(KnownPages.RaisedBed(raisedBedId));
    revalidatePath(KnownPages.RaisedBeds);
    revalidatePath(KnownPages.Schedule);
    revalidatePath(KnownPages.Operations);
    revalidatePath(KnownPages.Account(raisedBed.accountId));
    revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    revalidatePath(KnownPages.Sensors);

    return {
        success: true,
        message: 'Gredica je označena kao napuštena zbog neaktivnosti.',
    };
}

export type MergeRaisedBedsActionState = {
    success: boolean;
    message: string;
} | null;

export async function mergeRaisedBedsAction(
    _previousState: MergeRaisedBedsActionState,
    formData: FormData,
): Promise<MergeRaisedBedsActionState> {
    await auth(['admin']);

    const targetRaisedBedId = Number(formData.get('targetRaisedBedId'));
    const sourceRaisedBedId = Number(formData.get('sourceRaisedBedId'));

    if (
        !Number.isInteger(targetRaisedBedId) ||
        !Number.isInteger(sourceRaisedBedId)
    ) {
        return {
            success: false,
            message: 'Neispravan ID gredice.',
        };
    }

    if (targetRaisedBedId === sourceRaisedBedId) {
        return {
            success: false,
            message: 'Izvorna i odredišna gredica moraju biti različite.',
        };
    }

    const [targetRaisedBed, sourceRaisedBed] = await Promise.all([
        getRaisedBed(targetRaisedBedId),
        getRaisedBed(sourceRaisedBedId),
    ]);

    if (!targetRaisedBed || !sourceRaisedBed) {
        return {
            success: false,
            message: 'Jedna od gredica ne postoji.',
        };
    }

    if (!targetRaisedBed.physicalId || !sourceRaisedBed.physicalId) {
        return {
            success: false,
            message: 'Obje gredice moraju imati fizičku oznaku za spajanje.',
        };
    }

    if (targetRaisedBed.physicalId !== sourceRaisedBed.physicalId) {
        return {
            success: false,
            message:
                'Gredice se mogu spojiti samo ako imaju istu fizičku oznaku.',
        };
    }

    await mergeRaisedBeds(targetRaisedBedId, sourceRaisedBedId);

    revalidatePath(KnownPages.RaisedBed(targetRaisedBedId));
    revalidatePath(KnownPages.RaisedBeds);
    revalidatePath(KnownPages.Schedule);

    if (targetRaisedBed.accountId) {
        revalidatePath(KnownPages.Account(targetRaisedBed.accountId));
    }

    if (targetRaisedBed.gardenId) {
        revalidatePath(KnownPages.Garden(targetRaisedBed.gardenId));
    }

    return {
        success: true,
        message: `Gredica ${sourceRaisedBedId} uspješno je spojena u gredicu ${targetRaisedBedId}.`,
    };
}
