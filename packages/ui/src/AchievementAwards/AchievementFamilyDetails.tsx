import type {
    AchievementFamily,
    AchievementRecord,
} from '@gredice/js/achievements';
import { Check, Lock, Timer } from '../icons';
import { AchievementAward } from './AchievementAward';
import { AchievementLevelLabel } from './AchievementLevelLabel';

const stateLabels = {
    locked: 'Još nije ostvareno',
    pending: 'Čeka potvrdu',
    approved: 'Ostvareno',
    denied: 'Uvjet nije potvrđen',
};

function dateLabel(value: string | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function RewardDetails({
    achievement,
    reward,
}: {
    achievement?: AchievementRecord;
    reward: number;
}) {
    const effectiveReward = achievement?.rewardSunflowers ?? reward;
    const amount = effectiveReward.toLocaleString('hr-HR');
    if (achievement?.status !== 'approved')
        return (
            <p className="text-xs text-foreground/75">
                Nagrada: {amount} suncokreta
            </p>
        );
    const granted = dateLabel(achievement.rewardGrantedAt);
    return (
        <p className="text-xs text-foreground/75">
            {granted
                ? `Primljeno ${amount} suncokreta · ${granted}`
                : effectiveReward > 0
                  ? `Nagrada se obrađuje: ${amount} suncokreta`
                  : 'Bez nagrade u suncokretima'}
        </p>
    );
}

export function AchievementFamilyDetails({
    family,
}: {
    family: AchievementFamily;
}) {
    const featured = family.highestApproved ?? family.levels[0];
    return (
        <div className="space-y-5" data-achievement-family-details={family.key}>
            <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 p-4 text-center">
                <AchievementAward
                    achievementKey={featured.definition.key}
                    className={`size-40 sm:size-48 ${family.highestApproved ? '' : 'opacity-60 saturate-50'}`}
                    aria-hidden
                />
                <AchievementLevelLabel
                    level={featured.definition.level}
                    total={family.levels.length}
                />
                <p className="text-lg font-semibold">
                    {featured.definition.title.trim()}
                </p>
                {!family.highestApproved && (
                    <p className="text-sm text-foreground/75">
                        Tvoja prva nagrada u ovoj zbirci
                    </p>
                )}
            </div>
            <p className="text-sm text-foreground/75">
                Ostvarene razine: {family.approvedCount} /{' '}
                {family.levels.length}
            </p>
            <ol className="grid gap-3">
                {family.levels.map(({ definition, achievement }) => {
                    const state = achievement?.status ?? 'locked';
                    const earned = dateLabel(achievement?.earnedAt);
                    const approved = dateLabel(achievement?.approvedAt);
                    return (
                        <li
                            key={definition.key}
                            className="flex min-w-0 items-start gap-3 rounded-lg border p-3"
                            data-achievement-level={definition.level}
                            data-achievement-state={state}
                        >
                            <AchievementAward
                                achievementKey={definition.key}
                                className={`size-20 shrink-0 sm:size-24 ${state === 'locked' ? 'opacity-60 saturate-50' : ''}`}
                                aria-hidden
                            />
                            <div className="min-w-0 flex-1 space-y-1.5 py-1">
                                <AchievementLevelLabel
                                    level={definition.level}
                                    total={family.levels.length}
                                />
                                <h3 className="font-semibold leading-snug">
                                    {definition.title.trim()}
                                </h3>
                                <p className="text-sm text-foreground/75">
                                    {definition.description}
                                </p>
                                <p
                                    className={`flex items-center gap-1 text-xs font-medium ${state === 'approved' ? 'text-green-800 dark:text-green-300' : state === 'pending' ? 'text-amber-800 dark:text-amber-300' : 'text-foreground/75'}`}
                                >
                                    {state === 'approved' ? (
                                        <Check
                                            className="size-3.5 shrink-0"
                                            aria-hidden
                                        />
                                    ) : state === 'pending' ? (
                                        <Timer
                                            className="size-3.5 shrink-0"
                                            aria-hidden
                                        />
                                    ) : (
                                        <Lock
                                            className="size-3.5 shrink-0"
                                            aria-hidden
                                        />
                                    )}
                                    {stateLabels[state]}
                                    {earned && state === 'approved'
                                        ? ` · ${earned}`
                                        : ''}
                                </p>
                                {approved && state === 'approved' && (
                                    <p className="text-xs text-foreground/75">
                                        Potvrđeno: {approved}
                                    </p>
                                )}
                                <RewardDetails
                                    achievement={achievement}
                                    reward={definition.rewardSunflowers}
                                />
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
