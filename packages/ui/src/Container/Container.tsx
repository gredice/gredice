import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export type ContainerProps = HTMLAttributes<HTMLDivElement> & {
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
    centered?: boolean;
    padded?: boolean;
};

const maxWidthClassNames = {
    xs: 'max-w-md',
    sm: 'max-w-xl',
    md: 'max-w-4xl',
    lg: 'max-w-[1280px]',
    xl: 'max-w-[1536px]',
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
                'block w-full',
                maxWidth && maxWidthClassNames[maxWidth],
                centered && 'mx-auto',
                padded && 'px-4',
                className,
            )}
            {...rest}
        />
    );
}
