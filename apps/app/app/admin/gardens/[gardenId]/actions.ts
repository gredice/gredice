'use server';

import { getGarden, updateGarden } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { publicGardensFlag } from '../../../flags';

export async function updateGardenVisibilityAction({
    gardenId,
    isPublic,
}: {
    gardenId: number;
    isPublic: boolean;
}) {
    await auth(['admin']);

    if (!(await publicGardensFlag())) {
        return {
            success: false,
            message: 'Public gardens feature flag is disabled.',
        };
    }

    const garden = await getGarden(gardenId);
    if (!garden) {
        return {
            success: false,
            message: 'Garden not found.',
        };
    }

    await updateGarden({ id: gardenId, isPublic });

    revalidatePath(KnownPages.Gardens);
    revalidatePath(KnownPages.Garden(gardenId));
    revalidatePath('/vrtovi');
    revalidatePath(`/vrtovi/${gardenId.toString()}`);

    return {
        success: true,
        message: isPublic ? 'Garden is public.' : 'Garden is private.',
    };
}
