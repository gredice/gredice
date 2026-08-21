'use client';

import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import type { BaseUIEvent } from '@base-ui/react/types';
import {
    type AnchorHTMLAttributes,
    type ButtonHTMLAttributes,
    createContext,
    Fragment,
    forwardRef,
    type HTMLAttributes,
    isValidElement,
    type MouseEvent,
    type MouseEventHandler,
    type ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
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

const disabledCollisionAvoidance: { align: 'none'; side: 'none' } = {
    align: 'none',
    side: 'none',
};

type DropdownMenuContextValue = {
    portalContainer?: HTMLElement;
    registerTriggerElement(element: HTMLButtonElement | null): void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | undefined>(
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

function handleItemClick(
    event: BaseUIEvent<MouseEvent<HTMLElement>>,
    onClick: MouseEventHandler<HTMLElement> | undefined,
    onSelect: ((event: Event) => void) | undefined,
) {
    onClick?.(event);
    if (event.defaultPrevented) {
        event.preventBaseUIHandler();
    }

    onSelect?.(event.nativeEvent);
    if (event.nativeEvent.defaultPrevented) {
        event.preventBaseUIHandler();
    }
}

function getFinalFocusBehavior(handler: ((event: Event) => void) | undefined) {
    if (!handler) {
        return undefined;
    }

    return () => {
        const event = new Event('close-auto-focus', { cancelable: true });
        handler(event);
        return !event.defaultPrevented;
    };
}

export type DropdownMenuProps = {
    children?: ReactNode;
    defaultOpen?: boolean;
    dir?: UiDirection;
    modal?: boolean;
    onOpenChange?(open: boolean): void;
    open?: boolean;
};

export function DropdownMenu({ dir, ...props }: DropdownMenuProps) {
    const [portalContainer, setPortalContainer] = useState<HTMLElement>();
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
        () => ({ portalContainer, registerTriggerElement }),
        [portalContainer, registerTriggerElement],
    );

    return (
        <DirectionProvider direction={dir}>
            <DropdownMenuContext.Provider value={contextValue}>
                <MenuPrimitive.Root {...props} />
            </DropdownMenuContext.Provider>
        </DirectionProvider>
    );
}

export type DropdownMenuTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> &
    LegacyAsChildProps;

export const DropdownMenuTrigger = forwardRef<
    HTMLButtonElement,
    DropdownMenuTriggerProps
>(function DropdownMenuTrigger({ asChild, children, ...props }, ref) {
    const render = getLegacyRender(asChild, children);
    const context = useContext(DropdownMenuContext);
    const mergedRef = useCallback(
        (element: HTMLButtonElement | null) => {
            if (typeof ref === 'function') {
                ref(element);
            } else if (ref) {
                ref.current = element;
            }
            context?.registerTriggerElement(element);
        },
        [context?.registerTriggerElement, ref],
    );

    return (
        <MenuPrimitive.Trigger ref={mergedRef} render={render} {...props}>
            {render ? undefined : children}
        </MenuPrimitive.Trigger>
    );
});

export type DropdownMenuGroupProps = HTMLAttributes<HTMLDivElement> &
    LegacyAsChildProps;

export const DropdownMenuGroup = forwardRef<
    HTMLDivElement,
    DropdownMenuGroupProps
>(function DropdownMenuGroup({ asChild, children, ...props }, ref) {
    const render = getLegacyRender(asChild, children);

    return (
        <MenuPrimitive.Group ref={ref} render={render} {...props}>
            {render ? undefined : children}
        </MenuPrimitive.Group>
    );
});

export type DropdownMenuPortalProps = {
    children?: ReactNode;
    container?: HTMLElement | null;
    forceMount?: true;
};

export function DropdownMenuPortal({
    container,
    forceMount,
    ...props
}: DropdownMenuPortalProps) {
    const context = useContext(DropdownMenuContext);

    return (
        <MenuPrimitive.Portal
            container={container ?? context?.portalContainer}
            keepMounted={forceMount}
            {...props}
        />
    );
}

export type DropdownMenuSubProps = {
    children?: ReactNode;
    defaultOpen?: boolean;
    onOpenChange?(open: boolean): void;
    open?: boolean;
};

export function DropdownMenuSub(props: DropdownMenuSubProps) {
    return <MenuPrimitive.SubmenuRoot {...props} />;
}

export type DropdownMenuRadioGroupProps = HTMLAttributes<HTMLDivElement> &
    LegacyAsChildProps & {
        defaultValue?: string;
        disabled?: boolean;
        onValueChange?(value: string): void;
        value?: string;
    };

export const DropdownMenuRadioGroup = forwardRef<
    HTMLDivElement,
    DropdownMenuRadioGroupProps
>(function DropdownMenuRadioGroup({ asChild, children, ...props }, ref) {
    const render = getLegacyRender(asChild, children);

    return (
        <MenuPrimitive.RadioGroup ref={ref} render={render} {...props}>
            {render ? undefined : children}
        </MenuPrimitive.RadioGroup>
    );
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

type DropdownMenuPopupProps = {
    forceMount?: true;
    onCloseAutoFocus?(event: Event): void;
};

export type DropdownMenuContentProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'dir'
> &
    LegacyAsChildProps &
    DropdownMenuPositioningProps &
    DropdownMenuPopupProps;

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
    { className, inset, children, textValue, ...props },
    ref,
) {
    return (
        <MenuPrimitive.SubmenuTrigger
            className={cx(
                'flex cursor-default select-none items-center rounded-xs px-2 py-1.5 text-sm outline-hidden data-[highlighted]:bg-accent data-[popup-open]:bg-accent',
                inset && 'pl-8',
                className,
            )}
            label={textValue}
            ref={ref}
            {...props}
        >
            {children}
            <Navigate aria-hidden className="ml-auto size-4" />
        </MenuPrimitive.SubmenuTrigger>
    );
});

function getPositioningProps({
    align,
    alignOffset,
    arrowPadding,
    avoidCollisions,
    collisionBoundary,
    collisionPadding,
    hideWhenDetached,
    side,
    sideOffset,
    sticky,
    updatePositionStrategy,
}: DropdownMenuPositioningProps) {
    return {
        align,
        alignOffset,
        arrowPadding,
        className: hideWhenDetached ? 'data-[anchor-hidden]:hidden' : undefined,
        collisionAvoidance:
            avoidCollisions === false ? disabledCollisionAvoidance : undefined,
        collisionBoundary: getCollisionBoundary(collisionBoundary),
        collisionPadding,
        disableAnchorTracking: updatePositionStrategy === 'optimized',
        side,
        sideOffset,
        sticky: sticky === 'always',
    };
}

const menuPopupClassName =
    'z-50 max-h-(--available-height) min-w-32 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[starting-style]:zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 motion-reduce:animate-none motion-reduce:transition-none';

export const DropdownMenuSubContent = forwardRef<
    HTMLDivElement,
    Omit<DropdownMenuContentProps, 'align' | 'side'> & {
        align?: Exclude<UiAlign, 'center'>;
    }
>(function DropdownMenuSubContent(
    {
        align = 'start',
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
        onCloseAutoFocus,
        sideOffset,
        sticky,
        updatePositionStrategy,
        ...props
    },
    ref,
) {
    const render = getLegacyRender(asChild, children);
    const context = useContext(DropdownMenuContext);
    const positioningProps = getPositioningProps({
        align,
        alignOffset,
        arrowPadding,
        avoidCollisions,
        collisionBoundary,
        collisionPadding,
        hideWhenDetached,
        side: 'right',
        sideOffset,
        sticky,
        updatePositionStrategy,
    });

    return (
        <MenuPrimitive.Portal
            container={context?.portalContainer}
            keepMounted={forceMount}
        >
            <MenuPrimitive.Positioner
                {...positioningProps}
                data-base-ui-swipe-ignore
            >
                <MenuPrimitive.Popup
                    className={cx(menuPopupClassName, 'shadow-lg', className)}
                    finalFocus={getFinalFocusBehavior(onCloseAutoFocus)}
                    ref={ref}
                    render={render}
                    {...props}
                >
                    {render ? undefined : children}
                </MenuPrimitive.Popup>
            </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
    );
});

export const DropdownMenuContent = forwardRef<
    HTMLDivElement,
    DropdownMenuContentProps
>(function DropdownMenuContent(
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
        onCloseAutoFocus,
        side,
        sideOffset = 4,
        sticky,
        updatePositionStrategy,
        ...props
    },
    ref,
) {
    const render = getLegacyRender(asChild, children);
    const context = useContext(DropdownMenuContext);
    const positioningProps = getPositioningProps({
        align,
        alignOffset,
        arrowPadding,
        avoidCollisions,
        collisionBoundary,
        collisionPadding,
        hideWhenDetached,
        side,
        sideOffset,
        sticky,
        updatePositionStrategy,
    });

    return (
        <MenuPrimitive.Portal
            container={context?.portalContainer}
            keepMounted={forceMount}
        >
            <MenuPrimitive.Positioner
                {...positioningProps}
                data-base-ui-swipe-ignore
            >
                <MenuPrimitive.Popup
                    className={cx(menuPopupClassName, className)}
                    finalFocus={getFinalFocusBehavior(onCloseAutoFocus)}
                    ref={ref}
                    render={render}
                    {...props}
                >
                    {render ? undefined : children}
                </MenuPrimitive.Popup>
            </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
    );
});

export type DropdownMenuItemProps = Omit<
    HTMLAttributes<HTMLElement>,
    'onSelect'
> &
    LegacyAsChildProps & {
        closeOnClick?: boolean;
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

export const DropdownMenuItem = forwardRef<HTMLElement, DropdownMenuItemProps>(
    function DropdownMenuItem(
        {
            asChild,
            children,
            className,
            closeOnClick,
            disabled,
            endDecorator,
            href,
            inset,
            onClick,
            onSelect,
            rel,
            startDecorator,
            target,
            textValue,
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
            'relative flex cursor-default select-none items-center rounded-xs px-2 py-1.5 text-sm outline-hidden transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            inset && 'pl-8',
            className,
        );
        const handleClick = (event: BaseUIEvent<MouseEvent<HTMLElement>>) => {
            handleItemClick(event, onClick, onSelect);
        };

        if (href && !disabled) {
            return (
                <MenuPrimitive.LinkItem
                    className={itemClassName}
                    closeOnClick={closeOnClick ?? true}
                    href={href}
                    label={textValue}
                    onClick={handleClick}
                    ref={ref}
                    rel={rel}
                    target={target}
                    {...props}
                >
                    {content}
                </MenuPrimitive.LinkItem>
            );
        }

        const render = getLegacyRender(asChild, children);
        const disabledLink = href ? (
            <a href={href} rel={rel} target={target}>
                {content}
            </a>
        ) : undefined;

        return (
            <MenuPrimitive.Item
                className={itemClassName}
                closeOnClick={closeOnClick}
                disabled={disabled}
                label={textValue}
                onClick={handleClick}
                ref={ref}
                render={disabledLink ?? render}
                {...props}
            >
                {disabledLink || render ? undefined : content}
            </MenuPrimitive.Item>
        );
    },
);

export type DropdownMenuRadioItemProps = Omit<
    DropdownMenuItemProps,
    'href' | 'rel' | 'target'
> & {
    value: string;
};

export const DropdownMenuRadioItem = forwardRef<
    HTMLElement,
    DropdownMenuRadioItemProps
>(function DropdownMenuRadioItem(
    {
        asChild,
        children,
        className,
        closeOnClick,
        disabled,
        inset,
        onClick,
        onSelect,
        textValue,
        value,
        ...props
    },
    ref,
) {
    const render = getLegacyRender(asChild, children);

    return (
        <MenuPrimitive.RadioItem
            className={cx(
                'relative flex cursor-default select-none items-center rounded-xs px-2 py-1.5 text-sm outline-hidden transition-colors data-[checked]:bg-accent data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                inset && 'pl-8',
                className,
            )}
            closeOnClick={closeOnClick}
            disabled={disabled}
            label={textValue}
            onClick={(event) => handleItemClick(event, onClick, onSelect)}
            ref={ref}
            render={render}
            value={value}
            {...props}
        >
            {render ? undefined : children}
        </MenuPrimitive.RadioItem>
    );
});

export const DropdownMenuLabel = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement> &
        LegacyAsChildProps & {
            inset?: boolean;
        }
>(function DropdownMenuLabel(
    { asChild, children, className, inset, ...props },
    ref,
) {
    const render = getLegacyRender(asChild, children);

    if (render) {
        return <MenuPrimitive.Group render={render} {...props} />;
    }

    return (
        <div
            className={cx(
                'px-2 py-1.5 text-sm font-semibold',
                inset && 'pl-8',
                className,
            )}
            ref={ref}
            role="presentation"
            {...props}
        >
            {children}
        </div>
    );
});

export const DropdownMenuSeparator = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement> & LegacyAsChildProps
>(function DropdownMenuSeparator(
    { asChild, children, className, ...props },
    ref,
) {
    const render = getLegacyRender(asChild, children);

    return (
        <MenuPrimitive.Separator
            className={cx('-mx-1 my-1 h-px bg-muted', className)}
            ref={ref}
            render={render}
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
