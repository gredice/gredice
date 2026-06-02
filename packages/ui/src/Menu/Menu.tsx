'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import {
    type AnchorHTMLAttributes,
    type ComponentPropsWithoutRef,
    Fragment,
    forwardRef,
    type HTMLAttributes,
    type ReactNode,
} from 'react';
import { Navigate } from '../icons';
import { Row } from '../Row';
import { cx } from '../utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuSubTrigger = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
        inset?: boolean;
    }
>(function DropdownMenuSubTrigger(
    { className, inset, children, ...props },
    ref,
) {
    return (
        <DropdownMenuPrimitive.SubTrigger
            className={cx(
                'flex cursor-default select-none items-center rounded-xs px-2 py-1.5 text-sm outline-hidden focus:bg-accent data-[state=open]:bg-accent',
                inset && 'pl-8',
                className,
            )}
            ref={ref}
            {...props}
        >
            {children}
            <Navigate aria-hidden className="ml-auto size-4" />
        </DropdownMenuPrimitive.SubTrigger>
    );
});

export const DropdownMenuSubContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, ...props }, ref) {
    return (
        <DropdownMenuPrimitive.SubContent
            className={cx(
                'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-32 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                className,
            )}
            ref={ref}
            {...props}
        />
    );
});

export const DropdownMenuContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 4, ...props }, ref) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                className={cx(
                    'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-32 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                    className,
                )}
                ref={ref}
                sideOffset={sideOffset}
                {...props}
            />
        </DropdownMenuPrimitive.Portal>
    );
});

export const DropdownMenuItem = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
        inset?: boolean;
        href?: string;
        rel?: string;
        startDecorator?: ReactNode;
        endDecorator?: ReactNode;
        target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
    }
>(function DropdownMenuItem(
    {
        children,
        className,
        endDecorator,
        href,
        inset,
        rel,
        startDecorator,
        target,
        ...props
    },
    ref,
) {
    const content =
        startDecorator || endDecorator ? (
            <Row className="w-full" spacing={2}>
                {startDecorator}
                {children}
                {endDecorator}
            </Row>
        ) : (
            children
        );
    const itemClassName = cx(
        'relative flex cursor-default select-none items-center rounded-xs px-2 py-1.5 text-sm outline-hidden transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className,
    );

    if (href) {
        return (
            <DropdownMenuPrimitive.Item
                asChild
                className={itemClassName}
                {...props}
            >
                <a href={href} rel={rel} target={target}>
                    {content}
                </a>
            </DropdownMenuPrimitive.Item>
        );
    }

    return (
        <DropdownMenuPrimitive.Item
            className={itemClassName}
            ref={ref}
            {...props}
        >
            {content}
        </DropdownMenuPrimitive.Item>
    );
});

export const DropdownMenuLabel = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
        inset?: boolean;
    }
>(function DropdownMenuLabel({ className, inset, ...props }, ref) {
    return (
        <DropdownMenuPrimitive.Label
            className={cx(
                'px-2 py-1.5 text-sm font-semibold',
                inset && 'pl-8',
                className,
            )}
            ref={ref}
            {...props}
        />
    );
});

export const DropdownMenuSeparator = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
    return (
        <DropdownMenuPrimitive.Separator
            className={cx('-mx-1 my-1 h-px bg-muted', className)}
            ref={ref}
            {...props}
        />
    );
});

export function DropdownMenuShortcut({
    className,
    ...props
}: HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cx(
                'ml-auto text-xs tracking-widest opacity-60',
                className,
            )}
            {...props}
        />
    );
}

DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export { Fragment as DropdownMenuItemFragment };
