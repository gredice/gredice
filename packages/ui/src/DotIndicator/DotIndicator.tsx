import type { ReactElement } from 'react';
import type { ColorVariants } from '../Typography';
import { cx } from '../utils';

export type DotIndicatorProps = {
    color: ColorVariants;
    variant?: 'outlined' | 'filled';
    content?: ReactElement;
    size?: number;
};

const colorClassNames = {
    success: 'bg-green-500 border-green-500',
    warning: 'bg-amber-500 border-amber-500',
    danger: 'bg-red-500 border-red-500',
    neutral: 'bg-muted-foreground border-muted-foreground',
    info: 'bg-blue-500 border-blue-500',
};

export function DotIndicator({
    color,
    content,
    size = 10,
    variant = 'filled',
}: DotIndicatorProps) {
    return (
        <span
            className={cx(
                'inline-flex items-center justify-center rounded-full border',
                colorClassNames[color],
                variant === 'outlined' && 'bg-transparent',
            )}
            style={{ height: size, width: size }}
        >
            {content}
        </span>
    );
}
