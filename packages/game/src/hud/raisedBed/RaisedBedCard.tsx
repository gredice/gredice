import { cx } from '@signalco/ui-primitives/cx';
import type { HTMLAttributes } from 'react';

export function RaisedBedCard({
    className,
    ...rest
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cx(
                'bg-gradient-to-br from-lime-100/90 dark:from-lime-200/80 to-lime-100/80 dark:to-lime-200/70 dark:text-green-950 rounded-sm md:rounded-3xl',
                className,
            )}
            {...rest}
        />
    );
}
