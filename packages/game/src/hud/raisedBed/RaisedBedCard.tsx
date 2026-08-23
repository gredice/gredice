import { cx } from '@gredice/ui/utils';
import type { HTMLAttributes } from 'react';

export function RaisedBedCard({
    className,
    ...rest
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cx(
                'rounded-xs bg-gradient-to-br from-lime-100/90 to-lime-100/80 text-primary dark:from-emerald-950/95 dark:to-lime-950/90 dark:text-lime-50 md:rounded-3xl',
                className,
            )}
            {...rest}
        />
    );
}
