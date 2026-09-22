'use server';

import { getUser, updateUser } from '@gredice/storage';
import { AVATAR_OPTIONS } from '@gredice/ui/AvatarSelectionMenu';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';

export type FarmProfileActionState =
    | {
          success: true;
          displayName: string;
          avatarUrl: string | null;
          message: string;
      }
    | { success: false; message: string }
    | null;

export async function updateFarmProfile(
    _previousState: FarmProfileActionState,
    formData: FormData,
): Promise<FarmProfileActionState> {
    const { userId } = await auth(['farmer', 'admin']);
    const nameValue = formData.get('displayName');
    const avatarValue = formData.get('avatarUrl');

    if (
        typeof nameValue !== 'string' ||
        !nameValue.trim() ||
        nameValue.trim().length > 100
    ) {
        return {
            success: false,
            message: 'Ime za prikaz mora sadržavati između 1 i 100 znakova.',
        };
    }

    if (typeof avatarValue !== 'string') {
        return { success: false, message: 'Odaberi valjan avatar.' };
    }

    const displayName = nameValue.trim();
    const avatarUrl = avatarValue || null;

    try {
        const user = await getUser(userId);
        if (!user) {
            return { success: false, message: 'Profil nije pronađen.' };
        }

        // Keep existing custom avatars when only the display name changes.
        if (
            avatarUrl !== null &&
            avatarUrl !== user.avatarUrl &&
            !AVATAR_OPTIONS.some((option) => option.avatarUrl === avatarUrl)
        ) {
            return { success: false, message: 'Odaberi valjan avatar.' };
        }

        await updateUser({ id: userId, displayName, avatarUrl });
    } catch {
        return {
            success: false,
            message: 'Profil nije spremljen. Pokušaj ponovno.',
        };
    }

    // The greeting and assigned-user avatars appear throughout the farm app.
    revalidatePath('/', 'layout');

    return {
        success: true,
        displayName,
        avatarUrl,
        message: 'Profil je spremljen.',
    };
}
