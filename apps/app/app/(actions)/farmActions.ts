'use server';

import { assignUserToFarm, getFarm, updateFarm } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

type AssignFarmUserActionState =
    | { success: true; message: string }
    | { success: false; message: string }
    | null;

export async function assignFarmUserAction(
    _prevState: AssignFarmUserActionState,
    formData: FormData,
): Promise<AssignFarmUserActionState> {
    await auth(['admin']);

    const farmIdValue = formData.get('farmId');
    const userIdValue = formData.get('userId');

    if (typeof farmIdValue !== 'string' || typeof userIdValue !== 'string') {
        return {
            success: false,
            message: 'Nevažeći podaci za farmu ili korisnika.',
        };
    }

    const farmId = Number.parseInt(farmIdValue, 10);
    const userId = userIdValue.trim();

    if (!Number.isFinite(farmId) || !userId) {
        return {
            success: false,
            message: 'Potrebno je odabrati farmu i korisnika.',
        };
    }

    const farm = await getFarm(farmId);
    if (!farm) {
        return {
            success: false,
            message: 'Farma nije pronađena.',
        };
    }

    const result = await assignUserToFarm(farmId, userId);

    if (!result) {
        return {
            success: false,
            message: 'Korisnik je već dodan u farmu.',
        };
    }

    revalidatePath(KnownPages.Farm(farmId));
    revalidatePath(KnownPages.Farms);

    return {
        success: true,
        message: 'Korisnik je uspješno dodan u farmu.',
    };
}

type UpdateFarmSlackChannelState =
    | { success: true; message: string }
    | { success: false; message: string }
    | null;

export async function updateFarmSlackChannelAction(
    _prevState: UpdateFarmSlackChannelState,
    formData: FormData,
): Promise<UpdateFarmSlackChannelState> {
    await auth(['admin']);

    const farmIdRaw = formData.get('farmId');
    if (typeof farmIdRaw !== 'string') {
        return {
            success: false,
            message: 'Nevažeći identifikator farme.',
        };
    }

    const farmId = Number.parseInt(farmIdRaw, 10);
    if (!Number.isFinite(farmId)) {
        return {
            success: false,
            message: 'Nevažeći identifikator farme.',
        };
    }

    const slackChannelIdRaw = formData.get('slackChannelId');
    const slackChannelId =
        typeof slackChannelIdRaw === 'string' ? slackChannelIdRaw.trim() : '';

    try {
        await updateFarm({
            id: farmId,
            slackChannelId: slackChannelId.length > 0 ? slackChannelId : null,
        });
        revalidatePath(KnownPages.Farm(farmId));
        return {
            success: true,
            message: 'Slack kanal je uspješno spremljen.',
        };
    } catch (error) {
        console.error('Failed to update farm Slack channel', {
            farmId,
            error,
        });
        return {
            success: false,
            message: 'Greška pri spremanju Slack kanala.',
        };
    }
}

type UpdateFarmSnowAccumulationState =
    | { success: true; message: string }
    | { success: false; message: string }
    | null;

export async function updateFarmSnowAccumulationAction(
    _prevState: UpdateFarmSnowAccumulationState,
    formData: FormData,
): Promise<UpdateFarmSnowAccumulationState> {
    await auth(['admin']);

    const farmIdRaw = formData.get('farmId');
    if (typeof farmIdRaw !== 'string') {
        return {
            success: false,
            message: 'Nevažeći identifikator farme.',
        };
    }

    const farmId = Number.parseInt(farmIdRaw, 10);
    if (!Number.isFinite(farmId)) {
        return {
            success: false,
            message: 'Nevažeći identifikator farme.',
        };
    }

    const snowAccumulationRaw = formData.get('snowAccumulation');
    if (typeof snowAccumulationRaw !== 'string') {
        return {
            success: false,
            message: 'Nevažeća vrijednost snijega.',
        };
    }

    const snowAccumulation = Number.parseFloat(snowAccumulationRaw);
    if (!Number.isFinite(snowAccumulation) || snowAccumulation < 0) {
        return {
            success: false,
            message: 'Snijeg mora biti pozitivan broj.',
        };
    }

    try {
        await updateFarm({
            id: farmId,
            snowAccumulation,
        });
        revalidatePath(KnownPages.Farm(farmId));
        return {
            success: true,
            message: 'Količina snijega je uspješno spremljena.',
        };
    } catch (error) {
        console.error('Failed to update farm snow accumulation', {
            farmId,
            error,
        });
        return {
            success: false,
            message: 'Greška pri spremanju količine snijega.',
        };
    }
}
