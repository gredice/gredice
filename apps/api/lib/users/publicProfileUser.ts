import { userIdToPublicId } from '@gredice/js/publicId';
import { safeUserDisplayName } from '@gredice/js/userDisplayName';
import type { SelectUser } from '@gredice/storage';

export function publicProfileUser(
    user: Pick<SelectUser, 'id' | 'displayName' | 'avatarUrl' | 'createdAt'> & {
        achievementCount?: number;
    },
) {
    return {
        id: user.id,
        publicId: userIdToPublicId(user.id),
        displayName: safeUserDisplayName(user.displayName),
        avatarUrl: user.avatarUrl,
        achievementCount: user.achievementCount ?? 0,
        createdAt: user.createdAt,
    };
}
