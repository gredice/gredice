'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
    type ComponentPropsWithoutRef,
    type ComponentRef,
    forwardRef,
} from 'react';
import { cx } from '../utils';

export type TooltipProps = ComponentPropsWithoutRef<
    typeof TooltipPrimitive.Root
> & {
    delayDuration?: ComponentPropsWithoutRef<
        typeof TooltipPrimitive.Provider
    >['delayDuration'];
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

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
    ComponentRef<typeof TooltipPrimitive.Content>,
    ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 4, ...props }, ref) {
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
});
