'use client';

import { Trophy } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { useMyCommunityEdits } from '../../hooks/useMyCommunityEdits';
import { communityRewardHint } from './communityRewards';

/**
 * Names the next community badge and its sunflower reward. Renders nothing
 * until the visitor's accepted count is known, and nothing once every badge is
 * earned.
 */
export function CommunityRewardHint({ className }: { className?: string }) {
    const { data } = useMyCommunityEdits();
    const hint = data ? communityRewardHint(data.acceptedCount) : null;
    if (!hint) {
        return null;
    }

    return (
        <p
            className={cx(
                'flex items-start gap-2 rounded-lg border border-green-700/20 bg-green-700/10 p-3 text-sm text-foreground',
                className,
            )}
            data-community-reward-hint
        >
            <Trophy aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{hint}</span>
        </p>
    );
}
