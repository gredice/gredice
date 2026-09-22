import type {
    AchievementActivity,
    AchievementActivityCategory,
    AchievementFamily,
} from '@gredice/js/achievements';

const units: Record<AchievementActivityCategory, string> = {
    planting: 'potvrđenih sadnji',
    watering: 'dovršenih zalijevanja',
    harvest: 'dovršenih berbi',
    community_editing: 'prihvaćenih izmjena',
    garden_diversity: 'različitih vrsta',
    seed_to_table: 'dovršenih ciklusa',
};

export function AchievementNextProgress({
    family,
    activity,
}: {
    family: AchievementFamily;
    activity?: AchievementActivity;
}) {
    const { key, nextLevel } = family;
    if (key === 'registration' || key === 'seasonal' || !nextLevel) return null;
    const threshold = nextLevel.definition.threshold;
    if (!threshold) return null;
    const count = activity?.counts[key];
    const available =
        typeof count === 'number' && Number.isFinite(count) && count >= 0;
    const value = available ? Math.min(Math.floor(count), threshold) : 0;
    const remaining = threshold - value;
    const reached = available && remaining === 0;
    const status = nextLevel.achievement?.status;
    const label = `${value.toLocaleString('hr-HR')} / ${threshold.toLocaleString('hr-HR')} ${units[key]}`;
    return (
        <section className="space-y-2" aria-label="Sljedeće postignuće">
            <p className="text-sm font-semibold">
                Sljedeće: {nextLevel.definition.title.trim()}
            </p>
            {available ? (
                <>
                    <p className="text-sm tabular-nums text-foreground/75">
                        {label}
                    </p>
                    <div
                        role="progressbar"
                        aria-label={`Napredak: ${family.label}`}
                        aria-valuemin={0}
                        aria-valuemax={threshold}
                        aria-valuenow={value}
                        aria-valuetext={label}
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                        <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(value / threshold) * 100}%` }}
                        />
                    </div>
                    <p className="text-xs text-foreground/75">
                        {status === 'denied'
                            ? 'Uvjet za ovu razinu nije potvrđen.'
                            : reached
                              ? status === 'pending'
                                  ? 'Uvjet je ispunjen. Postignuće čeka potvrdu.'
                                  : 'Uvjet je ispunjen. Postignuće čeka obradu i potvrdu.'
                              : `Do cilja nedostaje još ${remaining.toLocaleString('hr-HR')}.`}
                    </p>
                    {key === 'watering' && (
                        <p className="text-xs text-foreground/75">
                            Računaju se dovršena zalijevanja prema potrebama
                            biljaka.
                        </p>
                    )}
                </>
            ) : (
                <p className="text-sm text-foreground/75">
                    Napredak trenutno nije dostupan.
                </p>
            )}
        </section>
    );
}
