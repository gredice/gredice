import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

type RaisedBedFieldCardGridProps = {
    children: ReactNode;
    className?: string;
};

export const raisedBedFieldCardSelectClassName =
    'w-full min-w-0 [&_[role=combobox]]:h-8 [&_[role=combobox]]:min-w-0 [&_[role=combobox]]:gap-1.5 [&_[role=combobox]]:overflow-hidden [&_[role=combobox]]:border [&_[role=combobox]]:border-input [&_[role=combobox]]:!bg-background [&_[role=combobox]]:px-2 [&_[role=combobox]]:text-foreground [&_[role=combobox]]:shadow-xs [&_[role=combobox]]:hover:!bg-muted [&_[role=combobox]>span]:block [&_[role=combobox]>span]:min-w-0 [&_[role=combobox]>span]:truncate';

export const raisedBedFieldCardButtonClassName =
    'max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border border-input !bg-background text-foreground shadow-xs hover:!bg-muted hover:text-foreground [&>span]:min-w-0';

export const raisedBedFieldCardChipClassName =
    'min-w-0 max-w-full overflow-hidden';

export function RaisedBedFieldCardGrid({
    children,
    className,
}: RaisedBedFieldCardGridProps) {
    return (
        <div
            className={cx(
                'grid w-full min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-0 overflow-hidden rounded-lg border-r border-b',
                className,
            )}
        >
            {children}
        </div>
    );
}

type RaisedBedFieldCardProps = {
    fieldBadge: ReactNode;
    historyControl?: ReactNode;
    image?: ReactNode;
    locationControl?: ReactNode;
    plantSortControl: ReactNode;
    statusControl?: ReactNode;
    weedControl?: ReactNode;
    className?: string;
};

export function RaisedBedFieldCard({
    fieldBadge,
    historyControl,
    image,
    locationControl,
    plantSortControl,
    statusControl,
    weedControl,
    className,
}: RaisedBedFieldCardProps) {
    return (
        <div
            className={cx(
                'relative flex aspect-[4/3] min-h-40 min-w-0 max-w-full flex-col overflow-hidden border-l border-t bg-muted/40',
                className,
            )}
        >
            {image ? (
                <div className="absolute inset-0 overflow-hidden [&>img]:size-full">
                    {image}
                </div>
            ) : (
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
                {weedControl && <div className="min-w-0">{weedControl}</div>}
                {statusControl && (
                    <div className="min-w-0">{statusControl}</div>
                )}
            </div>
        </div>
    );
}
