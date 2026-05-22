import type { HTMLAttributes } from 'react';
import { LoaderSpinner } from '../icons';
import { cx } from '../utils';

export type SpinnerProps = HTMLAttributes<SVGSVGElement> & {
    loading?: boolean;
    loadingLabel: string;
};

export function Spinner({
    loading = true,
    loadingLabel,
    className,
    ...rest
}: SpinnerProps) {
    if (!loading) {
        return null;
    }

    return (
        <LoaderSpinner
            aria-label={loadingLabel}
            className={cx('size-4 animate-spin', className)}
            {...rest}
        />
    );
}
