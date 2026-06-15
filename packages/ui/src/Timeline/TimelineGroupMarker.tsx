import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export type TimelineGroupMarkerProps = HTMLAttributes<HTMLSpanElement> & {
    containerClassName?: string;
    hasItems: boolean;
    isFirst: boolean;
};

export function TimelineGroupMarker({
    className,
    containerClassName,
    hasItems,
    isFirst,
    ...props
}: TimelineGroupMarkerProps) {
    return (
        <div
            className={cx(
                'relative flex pl-9 sm:justify-center sm:pl-0',
                containerClassName,
            )}
        >
            {!isFirst ? (
                <span
                    aria-hidden
                    className="absolute left-[5px] -top-10 bottom-1/2 w-px bg-border sm:left-1/2 sm:-translate-x-1/2"
                />
            ) : null}
            {hasItems ? (
                <span
                    aria-hidden
                    className="absolute left-[5px] top-1/2 -bottom-8 w-px bg-border sm:left-1/2 sm:-translate-x-1/2"
                />
            ) : null}
            <span
                className={cx(
                    'relative z-10 inline-flex rounded-full bg-background px-3 py-1 text-sm font-semibold capitalize text-primary shadow-sm ring-1 ring-border/70',
                    className,
                )}
                {...props}
            />
        </div>
    );
}
