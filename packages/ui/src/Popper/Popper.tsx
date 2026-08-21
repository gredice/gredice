'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { HTMLAttributes, ReactNode } from 'react';
import type {
    UiAlign,
    UiCollisionPadding,
    UiSide,
    UiVirtualElementRef,
} from '../lib/primitiveTypes';
import { cx } from '../utils';

export type PopperProps = Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> & {
    trigger?: ReactNode;
    anchor?: ReactNode;
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
    onEscapeKeyDown?(event: Event): void;
    onPointerDownOutside?(event: Event): void;
    onFocusOutside?(event: Event): void;
    onInteractOutside?(event: Event): void;
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
    anchor,
    children,
    className,
    container,
    defaultOpen,
    modal,
    onOpenChange,
    open,
    side,
    sideOffset,
    trigger,
    virtualRef,
    ...rest
}: PopperProps) {
    const resolvedSideOffset = sideOffset ?? 4;
    const resolvedAlignOffset =
        alignOffset ?? (align === 'center' ? 0 : align === 'start' ? -4 : 4);

    return (
        <PopoverPrimitive.Root
            defaultOpen={defaultOpen}
            modal={modal}
            onOpenChange={onOpenChange}
            open={open}
        >
            {trigger ? (
                <PopoverPrimitive.Trigger asChild>
                    {trigger}
                </PopoverPrimitive.Trigger>
            ) : null}
            {virtualRef ? (
                <PopoverPrimitive.Anchor virtualRef={virtualRef} />
            ) : anchor ? (
                <PopoverPrimitive.Anchor asChild>
                    {anchor}
                </PopoverPrimitive.Anchor>
            ) : null}
            <PopoverPrimitive.Portal container={container}>
                <PopoverPrimitive.Content
                    align={align ?? 'center'}
                    alignOffset={resolvedAlignOffset}
                    className={cx(
                        'z-50 w-72 rounded-lg border bg-popover text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                        className,
                    )}
                    collisionPadding={Math.max(
                        resolvedSideOffset,
                        resolvedAlignOffset,
                    )}
                    side={side}
                    sideOffset={resolvedSideOffset}
                    {...rest}
                >
                    {children}
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
