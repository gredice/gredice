'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import {
    type AnchorHTMLAttributes,
    type ButtonHTMLAttributes,
    Fragment,
    forwardRef,
    type HTMLAttributes,
    type ReactNode,
} from 'react';
import { Navigate } from '../icons';
import type {
    LegacyAsChildProps,
    UiAlign,
    UiCollisionPadding,
    UiDirection,
    UiSide,
} from '../lib/primitiveTypes';
import { Row } from '../Row';
import { cx } from '../utils';

export type DropdownMenuProps = {
    children?: ReactNode;
    defaultOpen?: boolean;
    dir?: UiDirection;
    modal?: boolean;
    onOpenChange?(open: boolean): void;
    open?: boolean;
};

export function DropdownMenu(props: DropdownMenuProps) {
    return <DropdownMenuPrimitive.Root {...props} />;
}

export type DropdownMenuTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> &
    LegacyAsChildProps;

export const DropdownMenuTrigger = forwardRef<
    HTMLButtonElement,
    DropdownMenuTriggerProps
>(function DropdownMenuTrigger(props, ref) {
    return <DropdownMenuPrimitive.Trigger ref={ref} {...props} />;
});

export type DropdownMenuGroupProps = HTMLAttributes<HTMLDivElement> &
    LegacyAsChildProps;

export const DropdownMenuGroup = forwardRef<
    HTMLDivElement,
    DropdownMenuGroupProps
>(function DropdownMenuGroup(props, ref) {
    return <DropdownMenuPrimitive.Group ref={ref} {...props} />;
});

export type DropdownMenuPortalProps = {
    children?: ReactNode;
    container?: HTMLElement | null;
    forceMount?: true;
};

export function DropdownMenuPortal(props: DropdownMenuPortalProps) {
    return <DropdownMenuPrimitive.Portal {...props} />;
}

export type DropdownMenuSubProps = {
    children?: ReactNode;
    defaultOpen?: boolean;
    onOpenChange?(open: boolean): void;
    open?: boolean;
};

export function DropdownMenuSub(props: DropdownMenuSubProps) {
    return <DropdownMenuPrimitive.Sub {...props} />;
}

export type DropdownMenuRadioGroupProps = HTMLAttributes<HTMLDivElement> &
    LegacyAsChildProps & {
        onValueChange?(value: string): void;
        value?: string;
    };

export const DropdownMenuRadioGroup = forwardRef<
    HTMLDivElement,
    DropdownMenuRadioGroupProps
>(function DropdownMenuRadioGroup(props, ref) {
    return <DropdownMenuPrimitive.RadioGroup ref={ref} {...props} />;
});

type DropdownMenuPositioningProps = {
    align?: UiAlign;
    alignOffset?: number;
    arrowPadding?: number;
    avoidCollisions?: boolean;
    collisionBoundary?: Element | null | Array<Element | null>;
    collisionPadding?: UiCollisionPadding;
    hideWhenDetached?: boolean;
    side?: UiSide;
    sideOffset?: number;
    sticky?: 'partial' | 'always';
    updatePositionStrategy?: 'optimized' | 'always';
};

type DropdownMenuDismissalProps = {
    forceMount?: true;
    loop?: boolean;
    onCloseAutoFocus?(event: Event): void;
    onEscapeKeyDown?(event: Event): void;
    onFocusOutside?(event: Event): void;
    onInteractOutside?(event: Event): void;
    onPointerDownOutside?(event: Event): void;
};

export type DropdownMenuContentProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'dir'
> &
    LegacyAsChildProps &
    DropdownMenuPositioningProps &
    DropdownMenuDismissalProps;

export type DropdownMenuSubTriggerProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'onSelect'
> & {
    disabled?: boolean;
    inset?: boolean;
    textValue?: string;
};

export const DropdownMenuSubTrigger = forwardRef<
    HTMLDivElement,
    DropdownMenuSubTriggerProps
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
    Omit<DropdownMenuContentProps, 'align' | 'onCloseAutoFocus' | 'side'> & {
        align?: Exclude<UiAlign, 'center'>;
    }
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
    DropdownMenuContentProps
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

export type DropdownMenuItemProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'onSelect'
> &
    LegacyAsChildProps & {
        disabled?: boolean;
        inset?: boolean;
        href?: string;
        onSelect?(event: Event): void;
        rel?: string;
        startDecorator?: ReactNode;
        endDecorator?: ReactNode;
        target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
        textValue?: string;
    };

export const DropdownMenuItem = forwardRef<
    HTMLDivElement,
    DropdownMenuItemProps
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
    HTMLAttributes<HTMLDivElement> &
        LegacyAsChildProps & {
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
    HTMLAttributes<HTMLDivElement> & LegacyAsChildProps
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
