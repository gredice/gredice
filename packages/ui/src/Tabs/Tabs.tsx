'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type {
    ComponentPropsWithoutRef,
    ComponentRef,
    CSSProperties,
    ForwardedRef,
} from 'react';
import { forwardRef, useCallback, useEffect, useState } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

function setForwardedRef<T>(ref: ForwardedRef<T>, value: T | null) {
    if (typeof ref === 'function') {
        ref(value);
        return;
    }

    if (ref) {
        ref.current = value;
    }
}

type TabsIndicator = {
    height: number;
    left: number;
    top: number;
    width: number;
};

function areIndicatorsEqual(
    current: TabsIndicator | null,
    next: TabsIndicator | null,
) {
    if (!current || !next) {
        return current === next;
    }

    return (
        Math.abs(current.height - next.height) < 0.5 &&
        Math.abs(current.left - next.left) < 0.5 &&
        Math.abs(current.top - next.top) < 0.5 &&
        Math.abs(current.width - next.width) < 0.5
    );
}

export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

export const Tabs = TabsPrimitive.Root;

export type TabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List>;

export const TabsList = forwardRef<
    ComponentRef<typeof TabsPrimitive.List>,
    TabsListProps
>(function TabsList({ className, ...props }, ref) {
    const [listElement, setListElement] = useState<ComponentRef<
        typeof TabsPrimitive.List
    > | null>(null);
    const [indicator, setIndicator] = useState<TabsIndicator | null>(null);
    const handleListRef = useCallback(
        (node: ComponentRef<typeof TabsPrimitive.List> | null) => {
            setListElement(node);
            setForwardedRef(ref, node);
        },
        [ref],
    );

    useEffect(() => {
        if (!listElement || typeof window === 'undefined') {
            return;
        }

        let frameId: number | undefined;

        function measureIndicator() {
            const activeTrigger = listElement.querySelector<HTMLElement>(
                '[role="tab"][data-state="active"]',
            );

            if (!activeTrigger) {
                setIndicator((current) =>
                    areIndicatorsEqual(current, null) ? current : null,
                );
                return;
            }

            const listRect = listElement.getBoundingClientRect();
            const activeRect = activeTrigger.getBoundingClientRect();
            const nextIndicator = {
                height: activeRect.height,
                left:
                    activeRect.left -
                    listRect.left +
                    listElement.scrollLeft -
                    listElement.clientLeft,
                top:
                    activeRect.top -
                    listRect.top +
                    listElement.scrollTop -
                    listElement.clientTop,
                width: activeRect.width,
            };

            setIndicator((current) =>
                areIndicatorsEqual(current, nextIndicator)
                    ? current
                    : nextIndicator,
            );
        }

        function updateIndicator() {
            if (frameId !== undefined) {
                window.cancelAnimationFrame(frameId);
            }

            frameId = window.requestAnimationFrame(measureIndicator);
        }

        let resizeObserver: ResizeObserver | undefined;

        function observeTabs() {
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver.observe(listElement);
                for (const tab of listElement.querySelectorAll<HTMLElement>(
                    '[role="tab"]',
                )) {
                    resizeObserver.observe(tab);
                }
            }

            updateIndicator();
        }

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(updateIndicator);
        }

        const mutationObserver = new MutationObserver(observeTabs);

        observeTabs();
        mutationObserver.observe(listElement, {
            attributeFilter: ['data-state', 'disabled'],
            attributes: true,
            childList: true,
            subtree: true,
        });
        listElement.addEventListener('scroll', updateIndicator, {
            passive: true,
        });
        window.addEventListener('resize', updateIndicator);

        return () => {
            if (frameId !== undefined) {
                window.cancelAnimationFrame(frameId);
            }

            mutationObserver.disconnect();
            resizeObserver?.disconnect();
            listElement.removeEventListener('scroll', updateIndicator);
            window.removeEventListener('resize', updateIndicator);
        };
    }, [listElement]);

    const indicatorStyle: CSSProperties | undefined = indicator
        ? {
              height: indicator.height,
              opacity: 1,
              transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
              width: indicator.width,
          }
        : undefined;

    return (
        <TabsPrimitive.List
            ref={handleListRef}
            className={cx(
                'relative isolate inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-border bg-muted/80 p-1 text-muted-foreground shadow-sm',
                className,
            )}
            {...props}
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 z-0 rounded-md bg-background opacity-0 shadow-sm transition-[transform,width,height,opacity] duration-200 ease-out motion-reduce:transition-none"
                style={indicatorStyle}
            />
            {props.children}
        </TabsPrimitive.List>
    );
});

export type TabsTriggerProps = ComponentPropsWithoutRef<
    typeof TabsPrimitive.Trigger
>;

export const TabsTrigger = forwardRef<
    ComponentRef<typeof TabsPrimitive.Trigger>,
    TabsTriggerProps
>(function TabsTrigger({ className, ...props }, ref) {
    return (
        <TabsPrimitive.Trigger
            ref={ref}
            className={cx(
                'relative z-10 inline-flex min-h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium leading-none text-muted-foreground transition-colors',
                'hover:bg-background/70 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:pointer-events-none disabled:opacity-50',
                'data-[state=active]:text-foreground data-[state=active]:hover:bg-transparent',
                className,
            )}
            {...props}
        />
    );
});

export type TabsContentProps = ComponentPropsWithoutRef<
    typeof TabsPrimitive.Content
>;

export const TabsContent = forwardRef<
    ComponentRef<typeof TabsPrimitive.Content>,
    TabsContentProps
>(function TabsContent({ className, ...props }, ref) {
    return (
        <TabsPrimitive.Content
            ref={ref}
            className={cx(
                'mt-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                className,
            )}
            {...props}
        />
    );
});
