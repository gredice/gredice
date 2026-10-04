import {
    type CSSProperties,
    forwardRef,
    type HTMLAttributes,
    type PropsWithChildren,
} from 'react';
import { cx } from '../utils';

export type StackProps = PropsWithChildren<
    HTMLAttributes<HTMLDivElement> & {
        spacing?: number;
        alignItems?: 'start' | 'center' | 'stretch';
        justifyContent?:
            | 'start'
            | 'center'
            | 'end'
            | 'space-between'
            | 'stretch';
    }
>;

function spacingStyle(spacing: number | undefined) {
    if (typeof spacing !== 'number') {
        return undefined;
    }

    return `${spacing * 0.25}rem`;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
    { spacing, alignItems, justifyContent, className, style, ...rest },
    ref,
) {
    const mergedStyle: CSSProperties = {
        gap: spacingStyle(spacing),
        alignItems,
        justifyContent,
        ...style,
    };

    return (
        <div
            className={cx('flex flex-col', className)}
            ref={ref}
            style={mergedStyle}
            {...rest}
        />
    );
});
