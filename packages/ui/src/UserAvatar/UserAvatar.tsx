import { initials } from '@gredice/js/initials';
import { Avatar, type AvatarProps } from '../Avatar';
import { cx } from '../utils';

export type UserAvatarProps = {
    avatarUrl?: string | null;
    displayName: string;
    animate?: boolean;
} & Pick<AvatarProps, 'className' | 'size'>;

export function UserAvatar({
    avatarUrl,
    displayName,
    className,
    size,
    animate,
}: UserAvatarProps) {
    const mergedClassName = cx(
        animate && 'animate-[avatar-in_300ms_ease-out]',
        className,
    );

    if (!avatarUrl) {
        return (
            <Avatar className={mergedClassName} size={size}>
                {initials(displayName)}
            </Avatar>
        );
    }

    return (
        <Avatar
            className={mergedClassName}
            src={avatarUrl}
            alt={displayName}
            size={size}
        />
    );
}
