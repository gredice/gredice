'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentPropsWithoutRef, ComponentRef } from 'react';
import { forwardRef } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

export const Tabs = TabsPrimitive.Root;

export type TabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List>;

export const TabsList = forwardRef<
    ComponentRef<typeof TabsPrimitive.List>,
    TabsListProps
>(function TabsList({ className, ...props }, ref) {
    return (
        <TabsPrimitive.List
            ref={ref}
            className={cx(
                'inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-border bg-muted/80 p-1 text-muted-foreground shadow-sm',
                className,
            )}
            {...props}
        />
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
                'inline-flex min-h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium leading-none text-muted-foreground transition-colors',
                'hover:bg-background/70 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:pointer-events-none disabled:opacity-50',
                'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
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
