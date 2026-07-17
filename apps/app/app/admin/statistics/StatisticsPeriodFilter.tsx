'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { StatisticsPeriodKey } from './statisticsPeriod';

const periodOptions: {
    value: StatisticsPeriodKey;
    label: string;
}[] = [
    { value: 'current-year', label: 'Ova godina' },
    { value: 'current-month', label: 'Ovaj mjesec' },
    { value: 'last-7-days', label: 'Zadnjih 7 dana' },
    { value: 'last-30-days', label: 'Zadnjih 30 dana' },
    { value: 'last-90-days', label: 'Zadnjih 90 dana' },
    { value: 'all-time', label: 'Cijelo razdoblje' },
    { value: 'custom', label: 'Prilagođeno' },
];

export function StatisticsPeriodFilter({
    initialPeriod,
    initialFrom,
    initialTo,
    maxDate,
    rangeLabel,
    label = 'Razdoblje',
    includeAllTime = true,
}: {
    initialPeriod: StatisticsPeriodKey;
    initialFrom: string;
    initialTo: string;
    maxDate: string;
    rangeLabel: string;
    label?: string;
    includeAllTime?: boolean;
}) {
    const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
    const [customFrom, setCustomFrom] = useState(initialFrom);
    const [customTo, setCustomTo] = useState(initialTo);
    const [isPending, startTransition] = useTransition();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const visiblePeriodOptions = includeAllTime
        ? periodOptions
        : periodOptions.filter((option) => option.value !== 'all-time');

    useEffect(() => {
        setSelectedPeriod(initialPeriod);
        setCustomFrom(initialFrom);
        setCustomTo(initialTo);
    }, [initialFrom, initialPeriod, initialTo]);

    const navigateToPeriod = (
        period: StatisticsPeriodKey,
        from?: string,
        to?: string,
    ) => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.delete('period');
        params.delete('from');
        params.delete('to');

        if (period !== 'current-year') {
            params.set('period', period);
        }

        if (period === 'custom' && from && to) {
            params.set('from', from);
            params.set('to', to);
        }

        const query = params.toString();
        const nextUrl = (query ? `${pathname}?${query}` : pathname) as Route;
        startTransition(() => {
            router.replace(nextUrl, { scroll: false });
        });
    };

    const handlePeriodChange = (period: StatisticsPeriodKey) => {
        setSelectedPeriod(period);

        if (period === 'custom') {
            navigateToPeriod(period, customFrom, customTo);
            return;
        }

        navigateToPeriod(period);
    };

    const customRangeError =
        customFrom > customTo
            ? 'Datum početka mora biti prije datuma kraja.'
            : customTo > maxDate
              ? 'Datum završetka ne može biti u budućnosti.'
              : null;

    return (
        <Stack spacing={2}>
            <div className="flex flex-wrap items-end gap-2">
                <SelectItems
                    label={label}
                    value={selectedPeriod}
                    onValueChange={handlePeriodChange}
                    items={visiblePeriodOptions}
                    className="w-full sm:w-56"
                    placeholder="Odaberi razdoblje"
                    searchable={false}
                    disabled={isPending}
                />
                <Chip color="neutral" variant="soft">
                    {rangeLabel}
                </Chip>
            </div>

            {selectedPeriod === 'custom' ? (
                <Stack spacing={1}>
                    <form
                        action={pathname}
                        className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_auto] sm:items-end"
                        method="get"
                    >
                        <input name="period" type="hidden" value="custom" />
                        <Input
                            type="date"
                            name="from"
                            value={customFrom}
                            max={maxDate}
                            onChange={(event) =>
                                setCustomFrom(event.target.value)
                            }
                            label="Od"
                            fullWidth
                            required
                            disabled={isPending}
                        />
                        <Input
                            type="date"
                            name="to"
                            value={customTo}
                            max={maxDate}
                            onChange={(event) =>
                                setCustomTo(event.target.value)
                            }
                            label="Do"
                            fullWidth
                            required
                            disabled={isPending}
                        />
                        <Button
                            size="sm"
                            type="submit"
                            disabled={
                                !customFrom ||
                                !customTo ||
                                Boolean(customRangeError) ||
                                isPending
                            }
                        >
                            Primijeni
                        </Button>
                    </form>
                    {customRangeError ? (
                        <Typography level="body3" className="text-destructive">
                            {customRangeError}
                        </Typography>
                    ) : null}
                </Stack>
            ) : null}
        </Stack>
    );
}
