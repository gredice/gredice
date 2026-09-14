import {
    type AchievementRecord,
    getAchievementDefinition,
    getAchievementFamilies,
} from '@gredice/js/achievements';
import {
    AchievementAward,
    AchievementLevelLabel,
} from '@gredice/ui/AchievementAwards';
import { IconButton } from '@gredice/ui/IconButton';
import { Close } from '@gredice/ui/icons';
import { useEffect, useRef, useState } from 'react';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';

type ApprovalNotice = {
    accountId: string;
    key: string;
    additionalCount: number;
};

/** Establish a baseline on first load/account change; only announce later approvals. */
export function AchievementApprovalNotice({
    achievements,
}: {
    achievements?: readonly AchievementRecord[];
}) {
    const accountId = useCurrentAccount().data?.id;
    const previous = useRef<{ accountId: string; keys: Set<string> } | null>(
        null,
    );
    const [notice, setNotice] = useState<ApprovalNotice | null>(null);
    useEffect(() => {
        if (!accountId || !achievements) {
            previous.current = null;
            setNotice(null);
            return;
        }
        const keys = new Set(
            achievements
                .filter((award) => award.status === 'approved')
                .map((award) => award.key),
        );
        const baseline = previous.current;
        previous.current = { accountId, keys };
        if (
            !baseline ||
            baseline.accountId !== accountId ||
            [...baseline.keys].some((key) => !keys.has(key))
        ) {
            setNotice(null);
            return;
        }
        const added = [...keys]
            .filter((key) => !baseline.keys.has(key))
            .flatMap((key) => {
                const definition = getAchievementDefinition(key);
                return definition ? [definition] : [];
            })
            .sort((a, b) => b.level - a.level || b.sortOrder - a.sortOrder);
        if (added[0])
            setNotice({
                accountId,
                key: added[0].key,
                additionalCount: added.length - 1,
            });
    }, [accountId, achievements]);
    if (!notice || notice.accountId !== accountId) return null;
    const definition = getAchievementDefinition(notice.key);
    if (!definition) return null;
    const family = getAchievementFamilies([]).find(
        (item) => item.key === definition.familyKey,
    );
    const major =
        definition.visualGrade === 'mastery' ||
        definition.visualGrade === 'legendary';
    return (
        <div
            className="relative mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 pr-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
            data-achievement-reveal={definition.key}
        >
            <AchievementAward
                achievementKey={definition.key}
                className={`${major ? 'size-28' : 'size-20'} shrink-0`}
                aria-hidden
            />
            <div role="status" className="min-w-0 space-y-1 text-sm">
                <p className="font-semibold">Nova razina u tvojoj zbirci!</p>
                <p>{definition.title.trim()}</p>
                <AchievementLevelLabel
                    level={definition.level}
                    total={family?.levels.length ?? definition.level}
                />
                {notice.additionalCount > 0 && (
                    <p className="text-xs text-foreground/75">
                        Još novih postignuća: {notice.additionalCount}
                    </p>
                )}
            </div>
            <IconButton
                aria-label="Zatvori obavijest o postignuću"
                className="absolute right-1 top-1"
                size="sm"
                variant="plain"
                onClick={() => setNotice(null)}
            >
                <Close className="size-4" />
            </IconButton>
        </div>
    );
}
