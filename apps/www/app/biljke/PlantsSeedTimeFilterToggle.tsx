'use client';

import { ThumbsUp } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';

const filterParamName = 'vrijemeZaSijanje';

export function PlantsSeedTimeFilterToggle({
    initialValue = '',
}: {
    initialValue?: string;
}) {
    const [seedTimeFilter, setSeedTimeFilter] = useClientSearchParam(
        filterParamName,
        initialValue,
    );
    const isEnabled = seedTimeFilter === '1';

    return (
        <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={
                isEnabled
                    ? 'Isključi filter vrijeme za sijanje'
                    : 'Uključi filter vrijeme za sijanje'
            }
            onClick={() => setSeedTimeFilter(isEnabled ? '' : '1')}
            className={cx(
                'inline-flex min-h-10 w-full max-w-full items-center justify-between gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:w-auto',
                isEnabled
                    ? 'border-lime-600 bg-lime-600 text-white shadow-xs hover:bg-lime-700'
                    : 'border-tertiary bg-background text-foreground hover:border-lime-600 hover:bg-lime-50 dark:hover:bg-lime-950/30',
            )}
        >
            <span className="inline-flex min-w-0 items-center gap-2">
                <span
                    aria-hidden
                    className={cx(
                        'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
                        isEnabled
                            ? 'bg-white/20 text-white'
                            : 'bg-lime-100 text-lime-700',
                    )}
                >
                    <ThumbsUp className="size-3.5" />
                </span>
                <span className="min-w-0 text-left leading-tight">
                    Samo &quot;Vrijeme za sijanje&quot;
                </span>
            </span>
            <span
                aria-hidden
                className={cx(
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
                    isEnabled
                        ? 'bg-lime-800/20 ring-1 ring-white/35'
                        : 'bg-tertiary',
                )}
            >
                <span
                    className={cx(
                        'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform',
                        isEnabled ? 'translate-x-4' : 'translate-x-0',
                    )}
                />
            </span>
        </button>
    );
}
