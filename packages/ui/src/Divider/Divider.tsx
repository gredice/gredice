import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export type DividerProps = HTMLAttributes<HTMLHRElement> & {
    orientation?: 'horizontal' | 'vertical';
    flex?: boolean;
};

export function Divider({
    orientation = 'horizontal',
    flex,
    className,
    ...rest
}: DividerProps) {
    return (
        <hr
            aria-orientation={orientation}
            className={cx(
                'border-0',
                'shrink-0 bg-border',
                orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
                flex && 'self-stretch',
                className,
            )}
            {...rest}
        />
    );
}
