import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export type ContainerProps = HTMLAttributes<HTMLDivElement> & {
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
    centered?: boolean;
    padded?: boolean;
};

const maxWidthClassNames = {
    xs: 'max-w-xs',
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
};

export function Container({
    maxWidth = 'lg',
    centered = true,
    padded = true,
    className,
    ...rest
}: ContainerProps) {
    return (
        <div
            className={cx(
                maxWidth && maxWidthClassNames[maxWidth],
                centered && 'mx-auto',
                padded && 'px-4',
                className,
            )}
            {...rest}
        />
    );
}
