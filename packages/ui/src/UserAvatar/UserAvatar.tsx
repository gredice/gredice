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
    size,
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
                    className={cx(
                        'absolute -bottom-1.5 -right-1 z-10',
                        size === 'sm' &&
                            'gap-0 border px-0.5 text-[9px] [&_svg]:size-2.5',
                    )}
                />
            )}
        </Avatar>
    );
}
