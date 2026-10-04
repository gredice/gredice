import type { AchievementFamily } from '@gredice/js/achievements';
import { Lock, Navigate } from '../icons';
import { AchievementAward } from './AchievementAward';
import { AchievementLevelLabel } from './AchievementLevelLabel';

export function AchievementFamilyCard({
    family,
    onSelect,
}: {
    family: AchievementFamily;
    onSelect: () => void;
}) {
    const featured = family.highestApproved ?? family.levels[0];
    if (!featured) return null;
    return (
        <button
            type="button"
            onClick={onSelect}
            data-achievement-family={family.key}
            className="group flex w-full min-w-0 items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`${family.label}: ${family.highestApproved ? `razina ${family.highestApproved.definition.level} od ${family.levels.length}` : 'još nema ostvarenih razina'}. Prikaži sve razine`}
        >
            <div className="relative size-24 shrink-0 sm:size-28">
                <AchievementAward
                    achievementKey={featured.definition.key}
                    className={`size-full ${family.highestApproved ? '' : 'opacity-60 saturate-50'}`}
                    aria-hidden
                />
                {!family.highestApproved && (
                    <Lock
                        aria-hidden
                        className="absolute bottom-0 right-0 size-5 rounded-full bg-card p-0.5 text-foreground/75"
                    />
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-semibold leading-snug">{family.label}</h3>
                {family.highestApproved ? (
                    <>
                        <AchievementLevelLabel
                            level={family.highestApproved.definition.level}
                            total={family.levels.length}
                        />
                        <p className="text-sm">
                            {featured.definition.title.trim()}
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-foreground/75">
                        Prvo postignuće te čeka
                    </p>
                )}
                {family.pendingCount > 0 && (
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        Na potvrdi: {family.pendingCount}
                    </p>
                )}
                {family.nextLevel ? (
                    <div className="flex items-center gap-2 border-t pt-2">
                        <AchievementAward
                            achievementKey={family.nextLevel.definition.key}
                            className="size-8 shrink-0 opacity-70"
                            aria-hidden
                        />
                        <div className="min-w-0 text-xs text-foreground/75">
                            <p>
                                Sljedeće:{' '}
                                {family.nextLevel.definition.title.trim()}
                            </p>
                            <p>
                                {family.nextLevel.definition.rewardSunflowers.toLocaleString(
                                    'hr-HR',
                                )}{' '}
                                suncokreta
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs font-medium text-green-800 dark:text-green-300">
                        {family.isComplete
                            ? 'Sve razine ostvarene'
                            : 'Najviša razina ostvarena'}
                    </p>
                )}
            </div>
            <Navigate
                aria-hidden
                className="size-4 shrink-0 text-foreground/75"
            />
        </button>
    );
}
