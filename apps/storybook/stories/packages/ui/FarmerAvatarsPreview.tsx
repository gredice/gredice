import type { AvatarProps } from '@gredice/ui/Avatar';
import {
    AVATAR_OPTIONS,
    AvatarSelectionMenu,
} from '@gredice/ui/AvatarSelectionMenu';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useState } from 'react';

const sizes: AvatarProps['size'][] = ['sm', 'md', 'lg'];

export function FarmerAvatarsPreview() {
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(
        AVATAR_OPTIONS[0].avatarUrl,
    );

    return (
        <section aria-label="Avatari farmera" className="space-y-6">
            <h2 className="text-lg font-semibold">Avatari farmera</h2>
            <div className="flex flex-wrap gap-8">
                {AVATAR_OPTIONS.map((option) => (
                    <div key={option.label} className="space-y-4">
                        <UserAvatar
                            avatarUrl={option.avatarUrl}
                            displayName={option.label}
                            className="size-32"
                        />
                        <h3 className="text-sm font-medium">{option.label}</h3>
                        <div className="flex items-center gap-5 pb-2">
                            {sizes.map((size, index) => (
                                <UserAvatar
                                    key={size}
                                    avatarUrl={option.avatarUrl}
                                    displayName={option.label}
                                    achievementCount={[0, 3, 10][index]}
                                    size={size}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <AvatarSelectionMenu
                displayName="Veseli vrtlar"
                onChange={setSelectedAvatar}
            >
                <button
                    type="button"
                    className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                    <UserAvatar
                        avatarUrl={selectedAvatar}
                        displayName="Veseli vrtlar"
                        size="lg"
                    />
                    Promijeni avatar
                </button>
            </AvatarSelectionMenu>
        </section>
    );
}
