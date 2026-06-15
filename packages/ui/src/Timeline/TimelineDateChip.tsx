import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export function TimelineDateChip({
    className,
    ...props
}: HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cx(
                'inline-flex rounded-md bg-foreground px-3 py-1 text-sm font-semibold text-background',
                className,
            )}
            {...props}
        />
    );
}
