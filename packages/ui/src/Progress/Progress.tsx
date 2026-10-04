import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export type ProgressProps = HTMLAttributes<HTMLDivElement> & {
    indeterminate?: boolean;
    max?: number;
    min?: number;
    trackClassName?: string;
    value?: number | null | undefined;
};

export function Progress({
    className,
    indeterminate = false,
    max = 100,
    min = 0,
    trackClassName,
    value,
    ...rest
}: ProgressProps) {
    const safeMax = max > min ? max : min + 100;
    const safeValue = (() => {
        if (indeterminate || value === null || value === undefined) {
            return null;
        }

        if (!Number.isFinite(value)) {
            return min;
        }

        return Math.min(Math.max(value, min), safeMax);
    })();
    const percentage =
        safeValue === null ? 100 : ((safeValue - min) / (safeMax - min)) * 100;

    return (
        <ProgressPrimitive.Root
            className={cx(
                'h-2 w-full overflow-hidden rounded-full bg-muted',
                className,
            )}
            max={safeMax}
            min={min}
            value={safeValue}
            {...rest}
        >
            <ProgressPrimitive.Indicator
                className={cx(
                    'h-full rounded-full bg-primary transition-all data-[indeterminate]:animate-pulse',
                    trackClassName,
                )}
                style={{ width: `${percentage}%` }}
            />
        </ProgressPrimitive.Root>
    );
}
