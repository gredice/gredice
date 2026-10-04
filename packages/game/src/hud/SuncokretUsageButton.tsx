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
        {
            label: 'Zadnja 24 sata',
            period: day,
            detail: 'Vanjski krug',
            tone: 'day',
        },
        {
            label: 'Ovaj tjedan',
            period: week,
            detail: 'Unutarnji krug',
            tone: 'week',
        },
    ];

    return (
        <Popper
            align="end"
            side="top"
            sideOffset={8}
            className="z-[70] w-72 p-3"
            data-suncokret-usage-popper
            trigger={
                <IconButton
                    aria-label={`Preostala AI upotreba: zadnja 24 sata ${formatSuncokretUsagePercent(dayRemaining)}, ovaj tjedan ${formatSuncokretUsagePercent(weekRemaining)}`}
                    title="Prikaži preostalu AI upotrebu"
                    type="button"
                    variant="plain"
                    className={cx(
                        'group size-9 shrink-0 rounded-full border border-border/70 bg-background/85 text-muted-foreground shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/80 dark:bg-background/70 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/60',
                        exhaustedUsage &&
                            'border-red-200 bg-red-50/80 text-red-700 hover:border-red-300 hover:bg-red-50 dark:border-red-950 dark:bg-red-950/40 dark:text-red-400 dark:hover:border-red-900 dark:hover:bg-red-950/60',
                    )}
                    data-suncokret-usage-trigger
                >
                    <svg
                        aria-hidden="true"
                        className="size-[22px] -rotate-90 overflow-visible"
                        viewBox="0 0 24 24"
                    >
                        <g data-suncokret-usage-ring="day">
                            <circle
                                cx="12"
                                cy="12"
                                r="9.25"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                className={cx(
                                    'text-muted-foreground/20',
                                    exhausted(day) && 'text-red-500/80',
                                )}
                            />
                            {!exhausted(day) && (
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="9.25"
                                    fill="none"
                                    pathLength="100"
                                    stroke="currentColor"
                                    strokeDasharray={`${dayRemaining} ${100 - dayRemaining}`}
                                    strokeLinecap="round"
                                    strokeWidth="2.5"
                                    className="text-emerald-600 transition-colors group-hover:text-emerald-700 dark:text-emerald-400 dark:group-hover:text-emerald-300"
                                />
                            )}
                        </g>
                        <g data-suncokret-usage-ring="week">
                            <circle
                                cx="12"
                                cy="12"
                                r="5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                className={cx(
                                    'text-muted-foreground/20',
                                    exhausted(week) && 'text-red-500/80',
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
                                    strokeDasharray={`${weekRemaining} ${100 - weekRemaining}`}
                                    strokeLinecap="round"
                                    strokeWidth="2.5"
                                    className="text-amber-400 transition-colors group-hover:text-amber-500 dark:text-amber-500 dark:group-hover:text-amber-400"
                                />
                            )}
                        </g>
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
                {periods.map(({ detail, label, period, tone }) => {
                    const remainingPercent = Math.max(
                        0,
                        Math.min(100, period.remainingPercent),
                    );
                    const remaining =
                        formatSuncokretUsagePercent(remainingPercent);
                    const periodExhausted = exhausted(period);

                    return (
                        <Stack key={label} spacing={1}>
                            <Row
                                justifyContent="space-between"
                                className="gap-2 text-xs"
                            >
                                <span className="flex items-center gap-1.5 font-medium">
                                    <span
                                        aria-hidden="true"
                                        className={cx(
                                            'size-1.5 rounded-full',
                                            periodExhausted
                                                ? 'bg-red-500'
                                                : tone === 'day'
                                                  ? 'bg-emerald-600 dark:bg-emerald-400'
                                                  : 'bg-amber-400 dark:bg-amber-500',
                                        )}
                                    />
                                    {label}
                                </span>
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
                                aria-valuenow={Math.round(remainingPercent)}
                                className={cx(
                                    'h-1.5 overflow-hidden rounded-full bg-muted',
                                    periodExhausted &&
                                        'bg-red-200 dark:bg-red-950',
                                )}
                                role="progressbar"
                            >
                                <div
                                    className={cx(
                                        'h-full rounded-full transition-[width] duration-300',
                                        periodExhausted
                                            ? 'bg-red-500'
                                            : tone === 'day'
                                              ? 'bg-emerald-600 dark:bg-emerald-500'
                                              : 'bg-amber-400 dark:bg-amber-500',
                                    )}
                                    style={{
                                        width: `${remainingPercent}%`,
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
