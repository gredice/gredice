import { getAchievementProgress } from '@gredice/js/achievements';
import { initials } from '@gredice/js/initials';
import { Avatar, type AvatarProps, resolveAvatarSource } from '../Avatar';
import { cx } from '../utils';
import { UserLevelBadge } from './UserLevelBadge';

export type UserAvatarProps = {
    avatarUrl?: string | null;
    displayName: string;
    animate?: boolean;
    achievementCount?: number;
} & Pick<AvatarProps, 'className' | 'size'>;

export function UserAvatar({
    avatarUrl,
    displayName,
    className,
    size = 'md',
    animate,
    achievementCount,
}: UserAvatarProps) {
    const mergedClassName = cx(
        animate && 'animate-[avatar-in_300ms_ease-out]',
        className,
    );

    return (
        <Avatar
            className={cx('relative overflow-visible', mergedClassName)}
            size={size}
        >
            <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]">
                {avatarUrl ? (
                    // biome-ignore lint/performance/noImgElement: User-provided avatar URLs do not require Next image configuration.
                    <img
                        src={resolveAvatarSource(avatarUrl)}
                        alt={displayName}
                        className="size-full object-cover"
                    />
                ) : (
                    initials(displayName)
                )}
            </span>
            {achievementCount !== undefined && (
                <UserLevelBadge
                    level={getAchievementProgress(achievementCount).level}
                    compact={size !== 'lg'}
                    className={cx(
                        'absolute z-10',
                        size === 'lg'
                            ? '-bottom-1.5 -right-1'
                            : '-bottom-1 -right-0.5',
                        size === 'sm' && 'h-3 min-w-3 text-[8px] leading-none',
                    )}
                />
            )}
        </Avatar>
    );
}
