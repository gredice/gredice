'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type {
    ButtonHTMLAttributes,
    ForwardedRef,
    HTMLAttributes,
    ReactNode,
} from 'react';
import {
    createContext,
    forwardRef,
    isValidElement,
    useCallback,
    useContext,
    useId,
    useMemo,
    useState,
} from 'react';
import type {
    LegacyAsChildProps,
    UiAlign,
    UiCollisionPadding,
    UiSide,
} from '../lib/primitiveTypes';
import { cx } from '../utils';

type TooltipContextValue = {
    contentId: string;
    open: boolean;
    portalContainer?: HTMLElement;
    registerTriggerElement(element: HTMLButtonElement | null): void;
    triggerId: string;
};

const TooltipContext = createContext<TooltipContextValue | undefined>(
    undefined,
);

function getLegacyRender(asChild: boolean | undefined, children: ReactNode) {
    return asChild && isValidElement(children) ? children : undefined;
}

function getCollisionBoundary(
    boundary: Element | null | Array<Element | null> | undefined,
) {
    if (!Array.isArray(boundary)) {
        return boundary ?? undefined;
    }

    const elements = boundary.filter(
        (candidate): candidate is Element => candidate !== null,
    );
    return elements.length > 0 ? elements : undefined;
}

function setForwardedRef(
    ref: ForwardedRef<HTMLButtonElement>,
    element: HTMLButtonElement | null,
) {
    if (typeof ref === 'function') {
        ref(element);
    } else if (ref) {
        ref.current = element;
    }
}

export type TooltipProps = {
    children?: ReactNode;
    defaultOpen?: boolean;
    delayDuration?: number;
    disableHoverableContent?: boolean;
    onOpenChange?(open: boolean): void;
    open?: boolean;
};

export function Tooltip({
    children,
    defaultOpen = false,
    delayDuration,
    disableHoverableContent,
    onOpenChange,
    open: openProp,
}: TooltipProps) {
    const triggerId = useId();
    const contentId = useId();
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const [portalContainer, setPortalContainer] = useState<HTMLElement>();
    const open = openProp ?? uncontrolledOpen;
    const registerTriggerElement = useCallback(
        (element: HTMLButtonElement | null) => {
            setPortalContainer(
                element?.closest<HTMLElement>(
                    '[role="dialog"], [role="alertdialog"]',
                ) ?? undefined,
            );
        },
        [],
    );
    const contextValue = useMemo(
        () => ({
            contentId,
            open,
            portalContainer,
            registerTriggerElement,
            triggerId,
        }),
        [contentId, open, portalContainer, registerTriggerElement, triggerId],
    );

    function handleOpenChange(nextOpen: boolean) {
        if (openProp === undefined) {
            setUncontrolledOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    }

    return (
        <TooltipPrimitive.Provider delay={delayDuration}>
            <TooltipContext.Provider value={contextValue}>
                <TooltipPrimitive.Root
                    disableHoverablePopup={disableHoverableContent}
                    onOpenChange={handleOpenChange}
                    open={open}
                    triggerId={triggerId}
                >
                    {children}
                </TooltipPrimitive.Root>
            </TooltipContext.Provider>
        </TooltipPrimitive.Provider>
    );
}

export type TooltipTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> &
    LegacyAsChildProps;

export const TooltipTrigger = forwardRef<
    HTMLButtonElement,
    TooltipTriggerProps
>(function TooltipTrigger({ asChild, children, ...props }, ref) {
    const render = getLegacyRender(asChild, children);
    const context = useContext(TooltipContext);
    const ariaDescribedBy = [
        props['aria-describedby'],
        context?.open ? context.contentId : undefined,
    ]
        .filter(Boolean)
        .join(' ');
    const mergedRef = useCallback(
        (element: HTMLButtonElement | null) => {
            setForwardedRef(ref, element);
            context?.registerTriggerElement(element);
        },
        [context?.registerTriggerElement, ref],
    );

    return (
        <TooltipPrimitive.Trigger
            closeOnClick={false}
            {...props}
            aria-describedby={ariaDescribedBy || undefined}
            id={context?.triggerId}
            ref={mergedRef}
            render={render}
        >
            {render ? undefined : children}
        </TooltipPrimitive.Trigger>
    );
});

export type TooltipContentProps = HTMLAttributes<HTMLDivElement> &
    LegacyAsChildProps & {
        align?: UiAlign;
        alignOffset?: number;
        arrowPadding?: number;
        avoidCollisions?: boolean;
        collisionBoundary?: Element | null | Array<Element | null>;
        collisionPadding?: UiCollisionPadding;
        forceMount?: true;
        hideWhenDetached?: boolean;
        side?: UiSide;
        sideOffset?: number;
        sticky?: 'partial' | 'always';
        updatePositionStrategy?: 'optimized' | 'always';
    };

export const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
    function TooltipContent(
        {
            align,
            alignOffset,
            arrowPadding,
            asChild,
            avoidCollisions,
            children,
            className,
            collisionBoundary,
            collisionPadding,
            forceMount,
            hideWhenDetached,
            side,
            sideOffset = 4,
            sticky,
            updatePositionStrategy,
            ...props
        },
        ref,
    ) {
        const render = getLegacyRender(asChild, children);
        const context = useContext(TooltipContext);

        return (
            <TooltipPrimitive.Portal
                container={context?.portalContainer}
                keepMounted={forceMount}
            >
                <TooltipPrimitive.Positioner
                    align={align}
                    alignOffset={alignOffset}
                    arrowPadding={arrowPadding}
                    className={
                        hideWhenDetached
                            ? 'data-[anchor-hidden]:hidden'
                            : undefined
                    }
                    collisionAvoidance={
                        avoidCollisions === false
                            ? { align: 'none', side: 'none' }
                            : undefined
                    }
                    collisionBoundary={getCollisionBoundary(collisionBoundary)}
                    collisionPadding={collisionPadding}
                    data-base-ui-swipe-ignore
                    disableAnchorTracking={
                        updatePositionStrategy === 'optimized'
                    }
                    side={side}
                    sideOffset={sideOffset}
                    sticky={sticky === 'always'}
                >
                    <TooltipPrimitive.Popup
                        className={cx(
                            'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[starting-style]:zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 motion-reduce:animate-none motion-reduce:transition-none',
                            className,
                        )}
                        {...props}
                        id={context?.contentId}
                        ref={ref}
                        render={render}
                        role="tooltip"
                    >
                        {render ? undefined : children}
                    </TooltipPrimitive.Popup>
                </TooltipPrimitive.Positioner>
            </TooltipPrimitive.Portal>
        );
    },
);
