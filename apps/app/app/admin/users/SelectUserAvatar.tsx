'use client';

import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useTransition } from 'react';
import { updateUserAvatar } from '../../(actions)/userActions';

export function SelectUserAvatar({
    userId,
    avatarUrl,
    displayName,
}: {
    userId: string;
    avatarUrl: string | null;
    displayName: string | null;
}) {
    const [isPending, startTransition] = useTransition();

    const handleAvatarChange = (nextAvatarUrl: string | null) => {
        startTransition(() => {
            void updateUserAvatar(userId, nextAvatarUrl);
        });
    };

    return (
        <AvatarSelectionMenu
            displayName={displayName}
            onChange={handleAvatarChange}
        >
            <button
                type="button"
                className="cursor-pointer rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
            >
                <UserAvatar
                    avatarUrl={avatarUrl}
                    displayName={displayName ?? 'User'}
                    size="lg"
                />
            </button>
        </AvatarSelectionMenu>
    );
}
