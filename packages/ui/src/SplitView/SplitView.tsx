'use client';

import {
    Children,
    forwardRef,
    type HTMLAttributes,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
    type TouchEvent as ReactTouchEvent,
    useCallback,
    useEffect,
    useRef,
} from 'react';
import { Divider } from '../Divider';
import { cx } from '../utils';

type ResizeOrientation = 'horizontal' | 'vertical';

type UseResizeSideProps = {
    orientation?: ResizeOrientation;
    onResize?: (size: number) => void;
    minSize?: number;
    maxSize?: number;
    collapsable?: boolean;
    collapsed?: boolean;
    collapseBreakpoint?: number;
    collapsedSize?: number;
    onCollapsedChanged?: (collapsed: boolean) => void;
    disableMobile?: boolean;
};

function useResizeSide({
    orientation = 'horizontal',
    onResize,
    minSize = 0,
    maxSize,
    collapsable,
    collapsed,
    collapseBreakpoint,
    collapsedSize,
    onCollapsedChanged,
    disableMobile,
}: UseResizeSideProps) {
    const fixedSideRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const resizingRef = useRef(false);
    const resizedRef = useRef(false);

    const applySize = useCallback(
        (size: number | undefined) => {
            const property = orientation === 'vertical' ? 'width' : 'height';

            if (size == null || (disableMobile && window.innerWidth < 768)) {
                fixedSideRef.current?.style.removeProperty(property);
                return;
            }

            const minimum =
                collapsable && collapsed ? (collapsedSize ?? 0) : minSize;
            const maximum =
                collapsable && collapsed
                    ? (collapsedSize ??
                      (orientation === 'vertical'
                          ? window.innerWidth
                          : window.innerHeight))
                    : (maxSize ??
                      (orientation === 'vertical'
                          ? window.innerWidth
                          : window.innerHeight));
            const nextSize = Math.max(minimum, Math.min(maximum, size));

            resizedRef.current = true;
            fixedSideRef.current?.style.setProperty(property, `${nextSize}px`);
            onResize?.(nextSize);
        },
        [
            collapsable,
            collapsed,
            collapsedSize,
            disableMobile,
            maxSize,
            minSize,
            onResize,
            orientation,
        ],
    );

    function stopMouseResize(event?: MouseEvent) {
        if (resizedRef.current) {
            event?.preventDefault();
            event?.stopPropagation();
        }

        resizingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopMouseResize);
    }

    function stopTouchResize(event?: TouchEvent) {
        if (resizedRef.current) {
            event?.stopPropagation();
        }

        resizingRef.current = false;
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', stopTouchResize);
    }

    function applyPointerPosition(position: number) {
        if (!resizingRef.current) {
            return;
        }

        const fixedSide = fixedSideRef.current;
        const handle = handleRef.current;
        const nextSize =
            orientation === 'vertical'
                ? position -
                  (fixedSide?.clientLeft ?? 0) -
                  (fixedSide?.offsetLeft ?? 0) -
                  (handle?.clientWidth ?? 0) / 2
                : position -
                  (fixedSide?.clientTop ?? 0) -
                  (fixedSide?.offsetTop ?? 0) -
                  (handle?.clientHeight ?? 0) / 2;
        const breakpoint = collapseBreakpoint ?? (collapsedSize ?? 0) * 3;

        if (collapsable && !collapsed && nextSize <= breakpoint) {
            onCollapsedChanged?.(true);
            stopTouchResize();
            stopMouseResize();
            return;
        }

        if (collapsable && collapsed && nextSize > (collapsedSize ?? 0)) {
            onCollapsedChanged?.(false);
            stopTouchResize();
            stopMouseResize();
            return;
        }

        applySize(nextSize);
    }

    function handleMouseMove(event: MouseEvent) {
        applyPointerPosition(
            orientation === 'vertical' ? event.clientX : event.clientY,
        );
    }

    function handleTouchMove(event: TouchEvent) {
        const touch = event.touches[0];
        if (!touch) {
            return;
        }

        applyPointerPosition(
            orientation === 'vertical' ? touch.clientX : touch.clientY,
        );
    }

    function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
        event.stopPropagation();
        event.preventDefault();
        resizingRef.current = true;
        resizedRef.current = false;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopMouseResize);
    }

    function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
        event.stopPropagation();
        resizingRef.current = true;
        resizedRef.current = false;
        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('touchend', stopTouchResize);
    }

    useEffect(() => {
        applySize(
            orientation === 'vertical'
                ? (fixedSideRef.current?.clientWidth ?? 0)
                : (fixedSideRef.current?.clientHeight ?? 0),
        );
    }, [applySize, orientation]);

    useEffect(() => {
        if (collapsable && collapsed) {
            applySize(collapsedSize ?? 0);
            return;
        }

        if (collapsable && !collapsed) {
            applySize(undefined);
        }
    }, [applySize, collapsable, collapsed, collapsedSize]);

    return {
        fixedSideRef,
        handleRef,
        handlers: {
            handleMouseDown,
            handleTouchStart,
        },
    };
}

type ResizeHandleProps = HTMLAttributes<HTMLDivElement> & {
    orientation?: ResizeOrientation;
};

const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
    function ResizeHandle(
        { orientation = 'horizontal', className, ...props },
        ref,
    ) {
        return (
            <div className="relative flex items-center">
                <div
                    className={cx(
                        'absolute hover:bg-muted/80',
                        orientation === 'horizontal' &&
                            'h-[9px] w-full -translate-y-1/2 hover:cursor-ns-resize',
                        orientation === 'vertical' &&
                            'h-full w-[9px] -translate-x-1/2 flex-col hover:cursor-ew-resize',
                        className,
                    )}
                    ref={ref}
                    {...props}
                />
                <Divider orientation={orientation} />
            </div>
        );
    },
);

export type SplitViewProps = {
    children?: ReactNode;
    size?: 'sm' | 'lg';
    minSize?: number;
    maxSize?: number;
    collapsable?: boolean;
    collapsed?: boolean;
    collapsedSize?: number;
    onCollapsedChanged?: (collapsed: boolean) => void;
};

export function SplitView({
    children,
    size,
    minSize,
    maxSize,
    collapsable,
    collapsed,
    collapsedSize,
    onCollapsedChanged,
}: SplitViewProps) {
    const content = Children.toArray(children);
    const { fixedSideRef, handleRef, handlers } = useResizeSide({
        orientation: 'vertical',
        minSize,
        maxSize,
        collapsable,
        collapsed: collapsed ?? false,
        collapsedSize: collapsedSize ?? 0,
        onCollapsedChanged: onCollapsedChanged ?? (() => {}),
        disableMobile: true,
    });

    return (
        <div className="md:h-full">
            <div className="md:grid md:h-full md:grid-cols-[auto_1px_5fr] md:grid-rows-[minmax(0,1fr)]">
                <div
                    className={cx(
                        'w-full md:h-full',
                        size === 'lg' ? 'md:w-[420px]' : 'md:w-[320px]',
                    )}
                    ref={fixedSideRef}
                >
                    {content[0]}
                </div>
                <ResizeHandle
                    className="hidden md:flex"
                    onMouseDown={handlers.handleMouseDown}
                    onTouchStart={handlers.handleTouchStart}
                    orientation="vertical"
                    ref={handleRef}
                />
                <div className="md:w-full">{content[1]}</div>
            </div>
        </div>
    );
}
