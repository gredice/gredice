import { getAchievementProgress } from '@gredice/js/achievements';
import { initials } from '@gredice/js/initials';
import { Link } from '../Link';
import { UserAvatar, type UserAvatarProps } from './UserAvatar';

export function UserAvatarLink({
    href,
    ...avatarProps
}: UserAvatarProps & { href?: string }) {
    if (!href) {
        return <UserAvatar {...avatarProps} />;
    }

    const level =
        avatarProps.achievementCount === undefined
            ? undefined
            : getAchievementProgress(avatarProps.achievementCount).level;
    const levelLabel = level === undefined ? '' : `, razina ${level}`;
    // Initials and the overlaid badge form one visible text label.
    const initialsLabel = avatarProps.avatarUrl
        ? ''
        : `, ${initials(avatarProps.displayName)}${level ?? ''}`;
    const label = `Otvori profil: ${avatarProps.displayName}${levelLabel}${initialsLabel}`;

    return (
        <Link
            href={href}
            aria-label={label}
            title={label}
            className="inline-flex shrink-0 rounded-full transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
            <UserAvatar {...avatarProps} />
        </Link>
    );
}
