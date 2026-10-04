import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils';
import { TimelineDateChip } from './TimelineDateChip';

export type TimelineEntryProps = HTMLAttributes<HTMLLIElement> & {
    index: number;
    isLast: boolean;
    label: ReactNode;
    labelClassName?: string;
    markerClassName?: string;
};

export function TimelineEntry({
    children,
    className,
    index,
    isLast,
    label,
    labelClassName,
    markerClassName,
    ...props
}: TimelineEntryProps) {
    const side = index % 2 === 0 ? 'right' : 'left';
    const labelContainerClassName =
        side === 'left'
            ? 'sm:col-start-3 sm:row-start-1 sm:flex sm:justify-start sm:pl-5'
            : 'sm:col-start-1 sm:row-start-1 sm:flex sm:justify-end sm:pr-5';
    const contentContainerClassName =
        side === 'left'
            ? 'sm:col-start-1 sm:row-start-1 sm:pr-7'
            : 'sm:col-start-3 sm:row-start-1 sm:pl-7';

    return (
        <li
            className={cx(
                'relative pl-9 sm:grid sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] sm:items-start sm:pl-0',
                className,
            )}
            {...props}
        >
            <span
                aria-hidden
                className="absolute left-[5px] -top-8 h-[calc(2rem+0.875rem)] w-px bg-border sm:left-1/2 sm:-translate-x-1/2"
            />
            <span
                aria-hidden
                className={cx(
                    'absolute left-0 top-2 z-10 flex size-3 items-center justify-center rounded-full bg-foreground ring-4 ring-background sm:left-1/2 sm:-translate-x-1/2',
                    markerClassName,
                )}
            />
            {!isLast ? (
                <span
                    aria-hidden
                    className="absolute left-[5px] top-[0.875rem] -bottom-8 w-px bg-border sm:left-1/2 sm:-translate-x-1/2"
                />
            ) : null}

            <div className="flex flex-col items-start gap-4 sm:contents">
                <div className={labelContainerClassName}>
                    <TimelineDateChip className={labelClassName}>
                        {label}
                    </TimelineDateChip>
                </div>
                <div className={contentContainerClassName}>{children}</div>
            </div>
        </li>
    );
}
