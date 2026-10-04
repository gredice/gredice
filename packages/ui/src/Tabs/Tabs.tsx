'use client';

import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, isValidElement, useContext } from 'react';
import type {
    LegacyAsChildProps,
    UiDirection,
    UiOrientation,
} from '../lib/primitiveTypes';

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

const TabsActivationContext = createContext(true);

function getLegacyRender(asChild: boolean | undefined, children: ReactNode) {
    return asChild && isValidElement(children) ? children : undefined;
}

export type TabsProps = HTMLAttributes<HTMLDivElement> &
    LegacyAsChildProps & {
        activationMode?: 'automatic' | 'manual';
        defaultValue?: string;
        dir?: UiDirection;
        onValueChange?(value: string): void;
        orientation?: UiOrientation;
        value?: string;
    };

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
    {
        activationMode = 'automatic',
        asChild,
        children,
        defaultValue,
        dir,
        onValueChange,
        value,
        ...props
    },
    ref,
) {
    const render = getLegacyRender(asChild, children);

    return (
        <DirectionProvider direction={dir}>
            <TabsActivationContext.Provider
                value={activationMode === 'automatic'}
            >
                <TabsPrimitive.Root
                    ref={ref}
                    defaultValue={defaultValue ?? null}
                    dir={dir}
                    onValueChange={(nextValue) => {
                        if (typeof nextValue === 'string') {
                            onValueChange?.(nextValue);
                        }
                    }}
                    render={render}
                    value={value}
                    {...props}
                >
                    {render ? undefined : children}
                </TabsPrimitive.Root>
            </TabsActivationContext.Provider>
        </DirectionProvider>
    );
});

export type TabsListProps = HTMLAttributes<HTMLDivElement> & {
    loop?: boolean;
};

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
    function TabsList({ children, className, loop, ...props }, ref) {
        const activateOnFocus = useContext(TabsActivationContext);

        return (
            <TabsPrimitive.List
                ref={ref}
                activateOnFocus={activateOnFocus}
                className={cx(
                    'relative isolate inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-border bg-muted/80 p-1 text-muted-foreground shadow-xs',
                    className,
                )}
                loopFocus={loop}
                {...props}
            >
                <TabsPrimitive.Indicator
                    className="pointer-events-none absolute left-0 top-0 z-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-md bg-background shadow-xs transition-[translate,width,height] duration-200 ease-out motion-reduce:transition-none"
                    renderBeforeHydration
                />
                {children}
            </TabsPrimitive.List>
        );
    },
);

export type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> &
    LegacyAsChildProps & {
        value: string;
    };

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
    function TabsTrigger({ asChild, children, className, ...props }, ref) {
        const render = getLegacyRender(asChild, children);

        return (
            <TabsPrimitive.Tab
                ref={ref}
                className={cx(
                    'relative z-10 inline-flex min-h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium leading-none text-muted-foreground transition-colors',
                    'hover:bg-background/70 hover:text-foreground',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'data-[active]:text-foreground data-[active]:hover:bg-transparent',
                    className,
                )}
                render={render}
                {...props}
            >
                {render ? undefined : children}
            </TabsPrimitive.Tab>
        );
    },
);

export type TabsContentProps = HTMLAttributes<HTMLDivElement> &
    LegacyAsChildProps & {
        forceMount?: true;
        value: string;
    };

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
    function TabsContent(
        { asChild, children, className, forceMount, ...props },
        ref,
    ) {
        const render = getLegacyRender(asChild, children);

        return (
            <TabsPrimitive.Panel
                ref={ref}
                className={cx(
                    'mt-2 outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [[hidden]]:hidden',
                    className,
                )}
                keepMounted={forceMount}
                render={render}
                {...props}
            >
                {render ? undefined : children}
            </TabsPrimitive.Panel>
        );
    },
);
