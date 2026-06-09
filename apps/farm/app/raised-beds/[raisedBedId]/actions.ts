'use server';

import {
    createPlantStatusApprovalRequest,
    getFarmUserRaisedBeds,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { isFarmPlantFieldStatus } from './plantStatusOptions';

export type PlantStateRequestActionState =
    | {
          success: true;
          message: string;
      }
    | {
          success: false;
          message: string;
      }
    | null;

function parseNumber(value: FormDataEntryValue | null) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

export async function requestPlantStateChangeAction(
    _previousState: PlantStateRequestActionState,
    formData: FormData,
): Promise<PlantStateRequestActionState> {
    const { userId } = await auth(['farmer', 'admin']);
    const raisedBedId = parseNumber(formData.get('raisedBedId'));
    const positionIndex = parseNumber(formData.get('positionIndex'));
    const requestedStatusValue = formData.get('status');
    const requestedStatus =
        typeof requestedStatusValue === 'string'
            ? requestedStatusValue.trim()
            : null;

    if (
        raisedBedId === null ||
        positionIndex === null ||
        requestedStatus === null ||
        !isFarmPlantFieldStatus(requestedStatus)
    ) {
        return {
            success: false,
            message: 'Odaberite valjano stanje biljke.',
        };
    }

    const raisedBeds = await getFarmUserRaisedBeds(userId);
    const raisedBed = raisedBeds.find((item) => item.id === raisedBedId);
    const field = raisedBed?.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );

    if (!raisedBed || !field?.plantStatus) {
        return {
            success: false,
            message: 'Biljka nije pronađena ili nije dostupna za promjenu.',
        };
    }

    if (requestedStatus === field.plantStatus) {
        return {
            success: false,
            message: 'Biljka je već u odabranom stanju.',
        };
    }

    if (
        requestedStatus === 'readyForTransplanting' &&
        field.sowingLocation !== 'greenhouse'
    ) {
        return {
            success: false,
            message:
                'Stanje spremnosti za presađivanje dostupno je samo za biljke iz staklenika.',
        };
    }

    try {
        await createPlantStatusApprovalRequest({
            raisedBedId,
            positionIndex,
            raisedBedFieldId: field.id,
            accountId: raisedBed.accountId,
            gardenId: raisedBed.gardenId,
            plantSortId: field.plantSortId,
            currentStatus: field.plantStatus,
            requestedStatus,
            requestedBy: userId,
            effectiveAt: new Date(),
        });
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Zahtjev za promjenu stanja nije spremljen.',
        };
    }

    revalidatePath(KnownPages.RaisedBed(raisedBedId));
    revalidatePath(KnownPages.RaisedBeds);
    revalidatePath(KnownPages.Greenhouse);

    return {
        success: true,
        message: 'Zahtjev je poslan administratorima na odobrenje.',
    };
}
