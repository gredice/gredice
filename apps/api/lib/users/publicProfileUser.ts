import { userIdToPublicId } from '@gredice/js/publicId';
import type { SelectUser } from '@gredice/storage';

export function publicProfileUser(
    user: Pick<SelectUser, 'id' | 'displayName' | 'avatarUrl' | 'createdAt'>,
) {
    const displayName = user.displayName?.trim();

    return {
        id: user.id,
        publicId: userIdToPublicId(user.id),
        displayName:
            displayName && !/\S+@\S+/u.test(displayName)
                ? displayName
                : 'Vrtlar',
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
    };
}
