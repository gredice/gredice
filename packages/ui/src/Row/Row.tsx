import { type CSSProperties, forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../utils';

export type RowProps = HTMLAttributes<HTMLDivElement> & {
    spacing?: number;
    alignItems?: 'start' | 'center' | 'stretch' | 'end';
    justifyContent?: CSSProperties['justifyContent'];
    justifyItems?: 'center';
    style?: CSSProperties;
};

function spacingStyle(spacing: number | undefined) {
    if (typeof spacing !== 'number') {
        return undefined;
    }

    return `${spacing * 0.25}rem`;
}

export const Row = forwardRef<HTMLDivElement, RowProps>(function Row(
    {
        spacing,
        alignItems,
        justifyContent,
        justifyItems,
        className,
        style,
        ...rest
    },
    ref,
) {
    const mergedStyle: CSSProperties = {
        gap: spacingStyle(spacing),
        alignItems,
        justifyContent,
        justifyItems,
        ...style,
    };

    return (
        <div
            className={cx('flex flex-row', className)}
            ref={ref}
            style={mergedStyle}
            {...rest}
        />
    );
});
