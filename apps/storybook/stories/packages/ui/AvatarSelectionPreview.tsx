import { AvatarSelectionMenu } from '@gredice/ui/AvatarSelectionMenu';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useState } from 'react';

export function AvatarSelectionPreview() {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(
        'https://cdn.gredice.com/avatars/garden-robot.webp',
    );

    return (
        <AvatarSelectionMenu
            displayName="Veseli vrtlar"
            avatarUrl={avatarUrl}
            onChange={setAvatarUrl}
        >
            <button
                type="button"
                className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
            >
                <UserAvatar
                    avatarUrl={avatarUrl}
                    displayName="Veseli vrtlar"
                    achievementCount={3}
                    size="lg"
                />
                Promijeni avatar
            </button>
        </AvatarSelectionMenu>
    );
}
