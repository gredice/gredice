import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export type ProgressProps = HTMLAttributes<HTMLDivElement> & {
    value: number | undefined;
    trackClassName?: string;
};

export function Progress({
    className,
    trackClassName,
    value,
    ...rest
}: ProgressProps) {
    const safeValue =
        typeof value === 'number' && Number.isFinite(value)
            ? Math.min(Math.max(value, 0), 100)
            : 0;

    return (
        <div
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={safeValue}
            className={cx(
                'h-2 w-full overflow-hidden rounded-full bg-muted',
                className,
            )}
            role="progressbar"
            {...rest}
        >
            <div
                className={cx(
                    'h-full rounded-full bg-primary transition-all',
                    trackClassName,
                )}
                style={{ width: `${safeValue}%` }}
            />
        </div>
    );
}
