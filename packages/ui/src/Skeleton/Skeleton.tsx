import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export function Skeleton({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cx('animate-pulse rounded-md bg-muted', className)}
            {...props}
        />
    );
}
