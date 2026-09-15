import { Avatar } from '@gredice/ui/Avatar';
import { AVATAR_OPTIONS } from '@gredice/ui/AvatarSelectionMenu';
import { UserAvatar } from '@gredice/ui/UserAvatar';

export function AvatarCollectionFixture() {
    return (
        <div>
            {AVATAR_OPTIONS.map((option) => (
                <div key={option.id}>
                    <Avatar src={option.avatarUrl} alt={option.label} />
                    <UserAvatar
                        avatarUrl={option.avatarUrl}
                        displayName={`Profil: ${option.label}`}
                    />
                </div>
            ))}
        </div>
    );
}
