'use client';

import { cx } from '@gredice/ui/utils';
import {
    type HTMLAttributes,
    type ReactNode,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';

type ScrollState = {
    canScrollDown: boolean;
    canScrollUp: boolean;
};

type DataAttributes = {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

export type ScrollViewProps = HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
    contentClassName?: string;
    viewportClassName?: string;
    viewportProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
    topFadeClassName?: string;
    bottomFadeClassName?: string;
};

function isSameScrollState(current: ScrollState, next: ScrollState) {
    return (
        current.canScrollDown === next.canScrollDown &&
        current.canScrollUp === next.canScrollUp
    );
}

export function ScrollView({
    bottomFadeClassName,
    children,
    className,
    contentClassName,
    topFadeClassName,
    viewportClassName,
    viewportProps,
    ...rest
}: ScrollViewProps) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const {
        className: viewportPropsClassName,
        onScroll: handleViewportScroll,
        ...viewportRest
    } = viewportProps ?? {};
    const [scrollState, setScrollState] = useState<ScrollState>({
        canScrollDown: false,
        canScrollUp: false,
    });
    const updateScrollState = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) {
            return;
        }

        const scrollableDistance =
            viewport.scrollHeight - viewport.clientHeight;
        const nextState = {
            canScrollDown:
                scrollableDistance > 1 &&
                viewport.scrollTop < scrollableDistance - 1,
            canScrollUp: viewport.scrollTop > 1,
        };

        setScrollState((current) =>
            isSameScrollState(current, nextState) ? current : nextState,
        );
    }, []);

    useLayoutEffect(() => {
        updateScrollState();

        if (typeof window === 'undefined') {
            return;
        }

        const frameId = window.requestAnimationFrame(updateScrollState);
        const resizeObserver =
            typeof ResizeObserver === 'undefined'
                ? undefined
                : new ResizeObserver(updateScrollState);

        if (viewportRef.current) {
            resizeObserver?.observe(viewportRef.current);
        }
        if (contentRef.current) {
            resizeObserver?.observe(contentRef.current);
        }

        window.addEventListener('resize', updateScrollState);

        return () => {
            window.cancelAnimationFrame(frameId);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateScrollState);
        };
    }, [updateScrollState]);

    return (
        <div
            className={cx('relative min-w-0', className)}
            data-scroll-view
            {...rest}
        >
            <div
                ref={viewportRef}
                className={cx(
                    'min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain',
                    viewportClassName,
                    viewportPropsClassName,
                )}
                data-scroll-view-viewport
                onScroll={(event) => {
                    updateScrollState();
                    handleViewportScroll?.(event);
                }}
                {...viewportRest}
            >
                <div
                    ref={contentRef}
                    className={cx('min-w-0 max-w-full', contentClassName)}
                    data-scroll-view-content
                >
                    {children}
                </div>
            </div>
            <div
                aria-hidden="true"
                className={cx(
                    'pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent transition-opacity duration-150',
                    scrollState.canScrollUp ? 'opacity-100' : 'opacity-0',
                    topFadeClassName,
                )}
                data-scroll-view-top-fade
                data-visible={scrollState.canScrollUp ? 'true' : 'false'}
            />
            <div
                aria-hidden="true"
                className={cx(
                    'pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-background to-transparent transition-opacity duration-150',
                    scrollState.canScrollDown ? 'opacity-100' : 'opacity-0',
                    bottomFadeClassName,
                )}
                data-scroll-view-bottom-fade
                data-visible={scrollState.canScrollDown ? 'true' : 'false'}
            />
        </div>
    );
}
