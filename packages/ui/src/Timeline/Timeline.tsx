import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export type TimelineProps = HTMLAttributes<HTMLDivElement> & {
    contentClassName?: string;
};

export function Timeline({
    children,
    className,
    contentClassName,
    ...props
}: TimelineProps) {
    return (
        <div className={cx('relative', className)} {...props}>
            <div className={cx('space-y-10', contentClassName)}>{children}</div>
        </div>
    );
}
