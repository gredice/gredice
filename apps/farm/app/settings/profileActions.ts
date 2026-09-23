'use server';

import { safeUserDisplayName } from '@gredice/js/userDisplayName';
import { getUser, updateUser } from '@gredice/storage';
import { AVATAR_OPTIONS } from '@gredice/ui/AvatarSelectionMenu';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { getPostHogClient } from '../../lib/posthog-server';

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
    const updatedFields: string[] = [];

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

        // The form displays a safe fallback, so an untouched name must not
        // be persisted as a display-name override.
        const displayNameChanged =
            displayName !==
            safeUserDisplayName(user.displayName ?? user.userName);
        const avatarChanged = avatarUrl !== user.avatarUrl;

        if (displayNameChanged) {
            updatedFields.push('display_name');
        }
        if (avatarChanged) {
            updatedFields.push('avatar_url');
        }

        if (updatedFields.length > 0) {
            await updateUser({
                id: userId,
                ...(displayNameChanged ? { displayName } : {}),
                ...(avatarChanged ? { avatarUrl } : {}),
            });
        }
    } catch {
        return {
            success: false,
            message: 'Profil nije spremljen. Pokušaj ponovno.',
        };
    }

    // The greeting and assigned-user avatars appear throughout the farm app.
    revalidatePath('/', 'layout');

    if (updatedFields.length > 0) {
        try {
            await (await getPostHogClient()).capture({
                distinctId: userId,
                event: 'user_profile_updated',
                properties: {
                    updated_fields: updatedFields,
                    birthday_reward_granted: false,
                    birthday_reward_late: false,
                    surface: 'farm',
                },
            });
        } catch {
            // Analytics failures must not turn a saved profile into an error.
            console.warn('Farm profile update analytics unavailable.');
        }
    }

    return {
        success: true,
        displayName,
        avatarUrl,
        message: 'Profil je spremljen.',
    };
}
