import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils';
import { TimelineGroupMarker } from './TimelineGroupMarker';

export type TimelineGroupProps = HTMLAttributes<HTMLDivElement> & {
    hasItems?: boolean;
    isFirst: boolean;
    label: ReactNode;
    listClassName?: string;
    markerClassName?: string;
    markerContainerClassName?: string;
};

export function TimelineGroup({
    children,
    className,
    hasItems = true,
    isFirst,
    label,
    listClassName,
    markerClassName,
    markerContainerClassName,
    ...props
}: TimelineGroupProps) {
    return (
        <div className={cx('relative space-y-6', className)} {...props}>
            <TimelineGroupMarker
                className={markerClassName}
                containerClassName={markerContainerClassName}
                hasItems={hasItems}
                isFirst={isFirst}
            >
                {label}
            </TimelineGroupMarker>
            <ol className={cx('space-y-8', listClassName)}>{children}</ol>
        </div>
    );
}
