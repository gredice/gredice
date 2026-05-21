'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils';

export type PopperProps = HTMLAttributes<HTMLDivElement> & {
    trigger?: ReactNode;
    anchor?: ReactNode;
    open?: boolean;
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number;
    align?: 'start' | 'center' | 'end';
    alignOffset?: number;
    onOpenChange?: (open: boolean) => void;
    container?: HTMLElement;
};

export function Popper({
    align,
    alignOffset,
    anchor,
    children,
    className,
    container,
    onOpenChange,
    open,
    side,
    sideOffset,
    trigger,
    ...rest
}: PopperProps) {
    const resolvedSideOffset = sideOffset ?? 4;
    const resolvedAlignOffset =
        alignOffset ?? (align === 'center' ? 0 : align === 'start' ? -4 : 4);

    return (
        <PopoverPrimitive.Root onOpenChange={onOpenChange} open={open}>
            {trigger ? (
                <PopoverPrimitive.Trigger asChild>
                    {trigger}
                </PopoverPrimitive.Trigger>
            ) : null}
            {anchor ? (
                <PopoverPrimitive.Anchor asChild>
                    {anchor}
                </PopoverPrimitive.Anchor>
            ) : null}
            <PopoverPrimitive.Portal container={container}>
                <PopoverPrimitive.Content
                    align={align ?? 'center'}
                    alignOffset={resolvedAlignOffset}
                    className={cx(
                        'z-50 w-72 rounded-lg border bg-popover text-popover-foreground shadow-md outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
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
