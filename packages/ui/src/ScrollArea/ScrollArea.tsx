import {
    forwardRef,
    type HTMLAttributes,
    type ReactNode,
    type Ref,
} from 'react';
import { cx } from '../utils';

type DataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

export type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
    contentClassName?: string;
    fade?: 'both' | 'end' | 'none' | 'start';
    orientation?: 'horizontal' | 'vertical';
    viewportClassName?: string;
    viewportProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
    viewportRef?: Ref<HTMLDivElement>;
};

const fadeClassNames = {
    horizontal: {
        both: 'scroll-fade-x',
        end: 'scroll-fade-e',
        none: undefined,
        start: 'scroll-fade-s',
    },
    vertical: {
        both: 'scroll-fade-y',
        end: 'scroll-fade-b',
        none: undefined,
        start: 'scroll-fade-t',
    },
};

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
    function ScrollArea(
        {
            children,
            className,
            contentClassName,
            fade = 'both',
            orientation = 'vertical',
            viewportClassName,
            viewportProps,
            viewportRef,
            ...props
        },
        ref,
    ) {
        const { className: viewportPropsClassName, ...viewportRest } =
            viewportProps ?? {};

        return (
            <div
                className={cx('relative min-h-0 min-w-0', className)}
                data-scroll-area=""
                data-orientation={orientation}
                ref={ref}
                {...props}
            >
                <div
                    className={cx(
                        'min-w-0 max-w-full overscroll-contain',
                        orientation === 'vertical'
                            ? 'overflow-x-hidden overflow-y-auto'
                            : 'overflow-x-auto overflow-y-hidden',
                        fadeClassNames[orientation][fade],
                        viewportClassName,
                        viewportPropsClassName,
                    )}
                    data-scroll-area-viewport=""
                    ref={viewportRef}
                    {...viewportRest}
                >
                    <div
                        className={cx(
                            orientation === 'vertical'
                                ? 'min-w-0 max-w-full'
                                : 'w-max min-w-full',
                            contentClassName,
                        )}
                        data-scroll-area-content=""
                    >
                        {children}
                    </div>
                </div>
            </div>
        );
    },
);
