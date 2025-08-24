import { initials } from '@signalco/js';
import { Avatar, type AvatarProps } from '@signalco/ui-primitives/Avatar';
import { cx } from '@signalco/ui-primitives/cx';
import { useCurrentUser } from '../hooks/useCurrentUser';

export function ProfileAvatar({
    variant,
    className,
    size,
}: { variant?: 'transparentOnMobile' | 'normal' } & Pick<
    AvatarProps,
    'size' | 'className'
>) {
    const currentUser = useCurrentUser();
    const avatarUrl = currentUser.data?.avatarUrl;

    if (!avatarUrl) {
        return (
            <Avatar
                className={cx(
                    variant === 'transparentOnMobile' &&
                        'select-none border-none bg-transparent md:bg-muted md:border',
                    className,
                )}
                size={size}
            >
                {initials(currentUser.data?.displayName ?? '')}
            </Avatar>
        );
    }

    return (
        <Avatar
            className={cx(
                variant === 'transparentOnMobile' &&
                    'border-none bg-transparent md:bg-muted md:border',
                className,
            )}
            src={avatarUrl}
            alt={currentUser.data?.displayName ?? 'Avatar'}
            size={size}
        />
    );
}