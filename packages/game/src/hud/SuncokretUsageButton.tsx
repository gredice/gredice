'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    formatSuncokretUsagePercent,
    type SuncokretUsagePeriod,
} from './suncokretChatContext';

function exhausted(period: SuncokretUsagePeriod) {
    return period.remainingPercent <= 0;
}

export function SuncokretUsageButton({
    day,
    week,
}: {
    day: SuncokretUsagePeriod;
    week: SuncokretUsagePeriod;
}) {
    const dayRemaining = Math.max(0, Math.min(100, day.remainingPercent));
    const weekRemaining = Math.max(0, Math.min(100, week.remainingPercent));
    const exhaustedUsage = exhausted(day) || exhausted(week);
    const periods = [
        { label: 'Danas', period: day, detail: 'Vanjski krug' },
        { label: 'Ovaj tjedan', period: week, detail: 'Unutarnji krug' },
    ];

    return (
        <Popper
            align="end"
            side="top"
            sideOffset={8}
            className="w-72 p-3"
            trigger={
                <IconButton
                    aria-label={`Preostala AI upotreba: danas ${formatSuncokretUsagePercent(dayRemaining)}, ovaj tjedan ${formatSuncokretUsagePercent(weekRemaining)}`}
                    title="Prikaži preostalu AI upotrebu"
                    type="button"
                    variant="plain"
                    className={cx(
                        'size-9 shrink-0 rounded-full text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950',
                        exhaustedUsage &&
                            'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950',
                    )}
                    data-suncokret-usage-trigger
                >
                    <svg
                        aria-hidden="true"
                        className="size-5 -rotate-90"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={cx(
                                'text-muted-foreground/25',
                                exhausted(day) && 'text-red-500/70',
                            )}
                        />
                        {!exhausted(day) && (
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                fill="none"
                                pathLength="100"
                                stroke="currentColor"
                                strokeDasharray={`${dayRemaining} 100`}
                                strokeLinecap="round"
                                strokeWidth="2"
                                className="text-emerald-600 dark:text-emerald-400"
                            />
                        )}
                        <circle
                            cx="12"
                            cy="12"
                            r="5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="10"
                            className={cx(
                                'text-muted-foreground/20',
                                exhausted(week) && 'text-red-500/70',
                            )}
                        />
                        {!exhausted(week) && (
                            <circle
                                cx="12"
                                cy="12"
                                r="5"
                                fill="none"
                                pathLength="100"
                                stroke="currentColor"
                                strokeDasharray={`${weekRemaining} 100`}
                                strokeLinecap="round"
                                strokeWidth="10"
                                className="text-amber-400 dark:text-amber-500"
                            />
                        )}
                    </svg>
                </IconButton>
            }
        >
            <Stack spacing={3} data-suncokret-usage>
                <Stack spacing={0}>
                    <Typography level="body2" semiBold>
                        Preostala AI upotreba
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        Krugovi se prazne kako koristiš Suncokreta.
                    </Typography>
                </Stack>
                {periods.map(({ detail, label, period }) => {
                    const remaining = formatSuncokretUsagePercent(
                        period.remainingPercent,
                    );
                    const periodExhausted = exhausted(period);

                    return (
                        <Stack key={label} spacing={1}>
                            <Row
                                justifyContent="space-between"
                                className="gap-2 text-xs"
                            >
                                <span className="font-medium">{label}</span>
                                <span
                                    className={cx(
                                        'text-muted-foreground',
                                        periodExhausted &&
                                            'font-medium text-red-700 dark:text-red-400',
                                    )}
                                >
                                    {periodExhausted
                                        ? 'Iskorišteno'
                                        : `${remaining} preostalo`}
                                </span>
                            </Row>
                            <div
                                aria-label={`${label}: ${remaining} preostalo`}
                                aria-valuemax={100}
                                aria-valuemin={0}
                                aria-valuenow={Math.round(
                                    period.remainingPercent,
                                )}
                                className={cx(
                                    'h-1.5 overflow-hidden rounded-full bg-muted',
                                    periodExhausted &&
                                        'bg-red-200 dark:bg-red-950',
                                )}
                                role="progressbar"
                            >
                                <div
                                    className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 dark:bg-emerald-500"
                                    style={{
                                        width: `${period.remainingPercent}%`,
                                    }}
                                />
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {detail}
                            </span>
                        </Stack>
                    );
                })}
            </Stack>
        </Popper>
    );
}
