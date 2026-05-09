import { initials } from '@signalco/js';
import { Avatar, type AvatarProps } from '@signalco/ui-primitives/Avatar';
import { cx } from '@signalco/ui-primitives/cx';

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
