import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

type RaisedBedFieldCardGridProps = {
    children: ReactNode;
    className?: string;
};

export const raisedBedFieldCardSelectClassName =
    'w-full min-w-0 [&_[role=combobox]]:h-8 [&_[role=combobox]]:!bg-background/80 [&_[role=combobox]]:px-2 [&_[role=combobox]]:text-foreground [&_[role=combobox]]:ring-1 [&_[role=combobox]]:ring-border/70 [&_[role=combobox]]:backdrop-blur-md [&_[role=combobox]]:hover:!bg-background/90 [&_[role=combobox]>span]:min-w-0';

export const raisedBedFieldCardButtonClassName =
    '!bg-background/80 text-foreground ring-1 ring-border/70 backdrop-blur-md hover:!bg-background/90 hover:text-foreground';

export const raisedBedFieldCardChipClassName = 'backdrop-blur-md';

export function RaisedBedFieldCardGrid({
    children,
    className,
}: RaisedBedFieldCardGridProps) {
    return (
        <div
            className={cx(
                'grid grid-cols-3 auto-rows-fr gap-0 overflow-hidden rounded-lg border-r border-b',
                className,
            )}
        >
            {children}
        </div>
    );
}

type RaisedBedFieldCardProps = {
    datesControl?: ReactNode;
    fieldBadge: ReactNode;
    historyControl?: ReactNode;
    image?: ReactNode;
    locationControl?: ReactNode;
    plantSortControl: ReactNode;
    statusControl?: ReactNode;
    className?: string;
};

export function RaisedBedFieldCard({
    datesControl,
    fieldBadge,
    historyControl,
    image,
    locationControl,
    plantSortControl,
    statusControl,
    className,
}: RaisedBedFieldCardProps) {
    return (
        <div
            className={cx(
                'relative flex aspect-[4/3] min-h-48 min-w-0 flex-col overflow-hidden border-l border-t bg-muted/40',
                className,
            )}
        >
            {image ?? (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <Typography level="body2">Nema slike</Typography>
                </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/55 via-background/10 to-background/70" />
            <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1.5 p-2">
                <div className="min-w-0">{locationControl}</div>
                <div className="shrink-0">{fieldBadge}</div>
            </div>
            {historyControl && (
                <div className="absolute left-2 top-11 z-10">
                    {historyControl}
                </div>
            )}
            <div className="relative z-10 mt-auto flex min-w-0 flex-col gap-0.5 px-2 pb-2 pt-8">
                <div className="min-w-0">{plantSortControl}</div>
                {(statusControl || datesControl) && (
                    <Stack spacing={0.5}>
                        {statusControl ? (
                            <div className="min-w-0">
                                {statusControl}
                                {datesControl}
                            </div>
                        ) : (
                            <div>{datesControl}</div>
                        )}
                    </Stack>
                )}
            </div>
        </div>
    );
}
