'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import type {
    LegacyAsChildProps,
    UiAlign,
    UiCollisionPadding,
    UiSide,
} from '../lib/primitiveTypes';
import { cx } from '../utils';

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
    delayDuration,
    ...rootProps
}: TooltipProps) {
    return (
        <TooltipPrimitive.Provider delayDuration={delayDuration}>
            <TooltipPrimitive.Root {...rootProps}>
                {children}
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
}

export type TooltipTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> &
    LegacyAsChildProps;

export const TooltipTrigger = forwardRef<
    HTMLButtonElement,
    TooltipTriggerProps
>(function TooltipTrigger(props, ref) {
    return <TooltipPrimitive.Trigger ref={ref} {...props} />;
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
        onEscapeKeyDown?(event: Event): void;
        onPointerDownOutside?(event: Event): void;
        side?: UiSide;
        sideOffset?: number;
        sticky?: 'partial' | 'always';
        updatePositionStrategy?: 'optimized' | 'always';
    };

export const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
    function TooltipContent({ className, sideOffset = 4, ...props }, ref) {
        return (
            <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                    className={cx(
                        'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                        className,
                    )}
                    ref={ref}
                    sideOffset={sideOffset}
                    {...props}
                />
            </TooltipPrimitive.Portal>
        );
    },
);
