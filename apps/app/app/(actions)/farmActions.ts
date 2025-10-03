'use server';

import { assignUserToFarm, getFarm } from '@gredice/storage';
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
