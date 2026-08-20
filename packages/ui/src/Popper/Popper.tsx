'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import type { HTMLAttributes, ReactNode } from 'react';
import { isValidElement, useCallback, useState } from 'react';
import type {
    UiAlign,
    UiCollisionPadding,
    UiSide,
    UiVirtualElementRef,
} from '../lib/primitiveTypes';
import { cx } from '../utils';

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

function getFocusBehavior(handler: ((event: Event) => void) | undefined) {
    if (!handler) {
        return undefined;
    }

    return () => {
        const event = new Event('auto-focus', { cancelable: true });
        handler(event);
        return !event.defaultPrevented;
    };
}

export type PopperProps = Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> & {
    trigger?: ReactNode;
    virtualRef?: UiVirtualElementRef;
    open?: boolean;
    defaultOpen?: boolean;
    modal?: boolean;
    side?: UiSide;
    sideOffset?: number;
    align?: UiAlign;
    alignOffset?: number;
    onOpenChange?: (open: boolean) => void;
    onOpenAutoFocus?(event: Event): void;
    onCloseAutoFocus?(event: Event): void;
    container?: HTMLElement;
    arrowPadding?: number;
    avoidCollisions?: boolean;
    collisionBoundary?: Element | null | Array<Element | null>;
    collisionPadding?: UiCollisionPadding;
    forceMount?: true;
    hideWhenDetached?: boolean;
    sticky?: 'partial' | 'always';
    updatePositionStrategy?: 'optimized' | 'always';
};

export function Popper({
    align,
    alignOffset,
    arrowPadding,
    avoidCollisions,
    children,
    className,
    collisionBoundary,
    collisionPadding,
    container,
    defaultOpen,
    forceMount,
    hideWhenDetached,
    modal,
    onCloseAutoFocus,
    onOpenAutoFocus,
    onOpenChange,
    open,
    side,
    sideOffset,
    sticky,
    trigger,
    updatePositionStrategy,
    virtualRef,
    ...props
}: PopperProps) {
    const resolvedSideOffset = sideOffset ?? 4;
    const resolvedAlignOffset =
        alignOffset ?? (align === 'center' ? 0 : align === 'start' ? -4 : 4);
    const triggerRender = isValidElement(trigger) ? trigger : undefined;
    const [modalPortalContainer, setModalPortalContainer] =
        useState<HTMLElement>();
    const registerTriggerElement = useCallback(
        (element: HTMLElement | null) => {
            setModalPortalContainer(
                element?.closest<HTMLElement>(
                    '[role="dialog"], [role="alertdialog"]',
                ) ?? undefined,
            );
        },
        [],
    );

    return (
        <PopoverPrimitive.Root
            defaultOpen={defaultOpen}
            modal={modal}
            onOpenChange={onOpenChange}
            open={open}
        >
            {trigger ? (
                <PopoverPrimitive.Trigger
                    ref={registerTriggerElement}
                    render={triggerRender}
                >
                    {triggerRender ? undefined : trigger}
                </PopoverPrimitive.Trigger>
            ) : null}
            <PopoverPrimitive.Portal
                container={container ?? modalPortalContainer}
                keepMounted={forceMount}
            >
                <PopoverPrimitive.Positioner
                    align={align ?? 'center'}
                    alignOffset={resolvedAlignOffset}
                    anchor={virtualRef ? () => virtualRef.current : undefined}
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
                    collisionPadding={
                        collisionPadding ??
                        Math.max(
                            Math.abs(resolvedSideOffset),
                            Math.abs(resolvedAlignOffset),
                        )
                    }
                    disableAnchorTracking={
                        updatePositionStrategy === 'optimized'
                    }
                    side={side}
                    sideOffset={resolvedSideOffset}
                    sticky={sticky === 'always'}
                >
                    <PopoverPrimitive.Popup
                        className={cx(
                            'z-50 w-72 rounded-lg border bg-popover text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[starting-style]:zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 motion-reduce:animate-none motion-reduce:transition-none',
                            className,
                        )}
                        finalFocus={getFocusBehavior(onCloseAutoFocus)}
                        initialFocus={getFocusBehavior(onOpenAutoFocus)}
                        {...props}
                    >
                        {modal ? (
                            <PopoverPrimitive.Close className="sr-only">
                                Zatvori
                            </PopoverPrimitive.Close>
                        ) : null}
                        {children}
                    </PopoverPrimitive.Popup>
                </PopoverPrimitive.Positioner>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
