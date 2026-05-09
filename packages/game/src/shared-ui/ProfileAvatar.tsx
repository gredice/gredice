import { UserAvatar } from '@gredice/ui/UserAvatar';
import type { AvatarProps } from '@signalco/ui-primitives/Avatar';
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

    return (
        <UserAvatar
            avatarUrl={currentUser.data?.avatarUrl}
            displayName={currentUser.data?.displayName ?? ''}
            className={cx(
                variant === 'transparentOnMobile' &&
                    'select-none border-none bg-transparent md:bg-muted md:border',
                className,
            )}
            size={size}
        />
    );
}
