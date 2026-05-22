import type { HTMLAttributes } from 'react';
import { cx } from '../utils';
import './LoadingIndicator.css';

export type LoadingIndicatorProps = HTMLAttributes<HTMLDivElement> & {
    indicatorClassName?: string;
};

export function LoadingIndicator({
    className,
    indicatorClassName,
    ...rest
}: LoadingIndicatorProps) {
    return (
        <div
            className={cx('h-0.5 overflow-hidden bg-tertiary/70', className)}
            {...rest}
        >
            <div
                className={cx(
                    'gredice-loading-indicator__bar h-full w-full bg-gradient-to-r from-transparent via-white to-transparent',
                    indicatorClassName,
                )}
            />
        </div>
    );
}
