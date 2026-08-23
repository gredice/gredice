'use server';

import { updateUser } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';

export type FarmSchedulePreferenceActionState =
    | {
          success: true;
          enabled: boolean;
          message: string;
      }
    | {
          success: false;
          message: string;
      }
    | null;

export async function updateFarmSchedulePreference(
    _previousState: FarmSchedulePreferenceActionState,
    formData: FormData,
): Promise<FarmSchedulePreferenceActionState> {
    const { userId } = await auth(['farmer', 'admin']);
    const enabledValue = formData.get('groupWateringOperations');

    if (enabledValue !== 'true' && enabledValue !== 'false') {
        return {
            success: false,
            message: 'Postavka rasporeda nije valjana.',
        };
    }

    const enabled = enabledValue === 'true';

    try {
        await updateUser({
            id: userId,
            farmScheduleGroupedWateringEnabled: enabled,
        });
    } catch {
        return {
            success: false,
            message: 'Postavka rasporeda nije spremljena. Pokušaj ponovno.',
        };
    }

    revalidatePath('/schedule');
    revalidatePath('/settings');

    return {
        success: true,
        enabled,
        message: 'Postavka rasporeda je spremljena.',
    };
}
