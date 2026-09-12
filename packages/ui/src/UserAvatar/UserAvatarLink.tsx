import { Link } from '../Link';
import { UserAvatar, type UserAvatarProps } from './UserAvatar';

export function UserAvatarLink({
    href,
    ...avatarProps
}: UserAvatarProps & { href?: string }) {
    if (!href) {
        return <UserAvatar {...avatarProps} />;
    }

    const label = `Otvori profil: ${avatarProps.displayName}`;

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
