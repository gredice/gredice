import type { AvatarProps } from '@gredice/ui/Avatar';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { cx } from '@gredice/ui/utils';
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
