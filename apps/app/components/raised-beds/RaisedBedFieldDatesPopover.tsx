'use client';

import { Button } from '@gredice/ui/Button';
import { Calendar } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect, useState } from 'react';

export type RaisedBedFieldDateItem = {
    key: string;
    label: string;
    value: string | null;
    current?: boolean;
};

type RaisedBedFieldDatesPopoverProps = {
    items: RaisedBedFieldDateItem[];
    className?: string;
};

function parseDate(value: string | null) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

function formatShortDate(value: string | null) {
    const date = parseDate(value);
    if (!date) {
        return '-';
    }

    const currentYear = new Date().getFullYear();
    const format: Intl.DateTimeFormatOptions =
        date.getFullYear() === currentYear
            ? { day: '2-digit', month: '2-digit' }
            : { day: '2-digit', month: '2-digit', year: 'numeric' };

    return new Intl.DateTimeFormat('hr-HR', format).format(date);
}

export function RaisedBedFieldDatesPopover({
    items,
    className,
}: RaisedBedFieldDatesPopoverProps) {
    const [mounted, setMounted] = useState(false);
    const currentItem = items.find((item) => item.current);
    const triggerValue = currentItem?.value ?? null;
    const triggerLabel = triggerValue
        ? mounted
            ? formatShortDate(triggerValue)
            : '...'
        : 'Datumi';

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <Popper
            align="end"
            className="w-64 p-3"
            side="bottom"
            trigger={
                <Button
                    color="neutral"
                    size="sm"
                    startDecorator={<Calendar className="size-3.5" />}
                    title="Prikaži datume biljke"
                    variant="plain"
                    className={cx(
                        'h-8 shrink-0 justify-start px-2 text-muted-foreground hover:text-foreground',
                        className,
                    )}
                >
                    {triggerLabel}
                </Button>
            }
        >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
                {items.map((item) => (
                    <div className="contents" key={`${item.key}-${item.label}`}>
                        <Typography
                            level="body3"
                            className={
                                item.current
                                    ? 'font-medium text-foreground'
                                    : 'text-muted-foreground'
                            }
                        >
                            {item.label}
                        </Typography>
                        <Typography
                            level="body3"
                            className={
                                item.current
                                    ? 'font-medium text-foreground'
                                    : item.value
                                      ? 'text-foreground'
                                      : 'text-muted-foreground'
                            }
                            title={item.value ?? undefined}
                        >
                            {item.value
                                ? mounted
                                    ? formatShortDate(item.value)
                                    : '...'
                                : '-'}
                        </Typography>
                    </div>
                ))}
            </div>
        </Popper>
    );
}
