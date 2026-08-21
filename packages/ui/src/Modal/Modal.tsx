'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import {
    type HTMLAttributes,
    isValidElement,
    type ReactNode,
    useLayoutEffect,
    useState,
} from 'react';
import { Close } from '../icons';
import { cx } from '../utils';

export type ModalProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
    trigger?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    modal?: boolean;
    title: string;
    description?: ReactNode;
    hideClose?: boolean;
    disableMobile?: boolean;
    mobileOverride?: boolean;
    dismissible?: boolean;
    overlayClassName?: string;
};

export function Modal({
    children,
    className,
    description,
    dismissible = true,
    hideClose,
    modal,
    mobileOverride,
    disableMobile,
    onOpenChange,
    overlayClassName,
    open,
    title,
    trigger,
    ...rest
}: ModalProps) {
    const viewport = useViewport();
    const isMobile = viewport ? viewport.width < 768 : false;

    if (mobileOverride || (isMobile && !disableMobile)) {
        return (
            <MobileModal
                className={className}
                description={description}
                dismissible={dismissible}
                modal={modal}
                onOpenChange={onOpenChange}
                overlayClassName={overlayClassName}
                open={open}
                title={title}
                trigger={trigger}
                {...rest}
            >
                {children}
            </MobileModal>
        );
    }

    return (
        <DesktopModal
            className={className}
            description={description}
            dismissible={dismissible}
            hideClose={hideClose}
            modal={modal}
            onOpenChange={onOpenChange}
            overlayClassName={overlayClassName}
            open={open}
            title={title}
            trigger={trigger}
            {...rest}
        >
            {children}
        </DesktopModal>
    );
}

function DesktopModal({
    children,
    className,
    description,
    dismissible = true,
    hideClose,
    modal,
    onOpenChange,
    overlayClassName,
    open,
    title,
    trigger,
    ...rest
}: Omit<ModalProps, 'disableMobile' | 'mobileOverride'>) {
    const hasDescription = hasAccessibleDescription(description);
    const triggerRender = isValidElement(trigger) ? trigger : undefined;

    function handleOpenChange(
        nextOpen: boolean,
        eventDetails: DialogPrimitive.Root.ChangeEventDetails,
    ) {
        if (!dismissible && !nextOpen) {
            eventDetails.cancel();
            return;
        }

        onOpenChange?.(nextOpen);
    }

    return (
        <DialogPrimitive.Root
            disablePointerDismissal={!dismissible}
            modal={modal}
            onOpenChange={handleOpenChange}
            open={open}
        >
            {trigger ? (
                <DialogPrimitive.Trigger render={triggerRender}>
                    {triggerRender ? undefined : trigger}
                </DialogPrimitive.Trigger>
            ) : null}
            <DialogPrimitive.Portal>
                <DialogPrimitive.Backdrop
                    data-modal-backdrop="desktop"
                    className={cx(
                        'fixed inset-0 z-50 min-h-dvh bg-background/80 backdrop-blur-xs data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 motion-reduce:animate-none motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute',
                        overlayClassName,
                    )}
                />
                <DialogPrimitive.Viewport className="pointer-events-none fixed inset-0 z-50">
                    <DialogPrimitive.Popup
                        {...(hasDescription
                            ? {}
                            : { 'aria-describedby': undefined })}
                        className={cx(
                            'pointer-events-auto fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg min-w-0 -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-auto overflow-y-auto overscroll-contain border bg-background p-6 shadow-lg duration-200 [overflow-wrap:anywhere] data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[starting-style]:zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 motion-reduce:animate-none motion-reduce:transition-none sm:rounded-lg',
                            className,
                        )}
                        {...rest}
                    >
                        <DialogPrimitive.Title className="sr-only">
                            {title}
                        </DialogPrimitive.Title>
                        {hasDescription ? (
                            <DialogPrimitive.Description className="sr-only">
                                {description}
                            </DialogPrimitive.Description>
                        ) : null}
                        {children}
                        {dismissible && !hideClose ? (
                            <DialogPrimitive.Close className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-xs bg-accent text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none motion-reduce:transition-none">
                                <Close aria-hidden className="size-4" />
                                <span className="sr-only">Zatvori</span>
                            </DialogPrimitive.Close>
                        ) : null}
                    </DialogPrimitive.Popup>
                </DialogPrimitive.Viewport>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

function MobileModal({
    children,
    className,
    description,
    dismissible = true,
    modal,
    onOpenChange,
    overlayClassName,
    open,
    title,
    trigger,
    ...rest
}: Omit<ModalProps, 'disableMobile' | 'hideClose' | 'mobileOverride'>) {
    const hasDescription = hasAccessibleDescription(description);
    const triggerRender = isValidElement(trigger) ? trigger : undefined;

    function handleOpenChange(
        nextOpen: boolean,
        eventDetails: DrawerPrimitive.Root.ChangeEventDetails,
    ) {
        if (!dismissible && !nextOpen) {
            eventDetails.cancel();
            return;
        }

        onOpenChange?.(nextOpen);
    }

    return (
        <DrawerPrimitive.Root
            disablePointerDismissal={!dismissible}
            modal={modal}
            onOpenChange={handleOpenChange}
            open={open}
            swipeDirection="down"
        >
            {trigger ? (
                <DrawerPrimitive.Trigger render={triggerRender}>
                    {triggerRender ? undefined : trigger}
                </DrawerPrimitive.Trigger>
            ) : null}
            <DrawerPrimitive.VirtualKeyboardProvider>
                <DrawerPrimitive.Portal>
                    <DrawerPrimitive.Backdrop
                        data-modal-backdrop="mobile"
                        className={cx(
                            'fixed inset-0 z-50 min-h-dvh bg-black/50 [opacity:calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-300 ease-out data-[swiping]:duration-0 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[ending-style]:duration-[calc(var(--drawer-swipe-strength,1)*300ms)] motion-reduce:!animate-none motion-reduce:!transition-none motion-reduce:!duration-0 supports-[-webkit-touch-callout:none]:absolute',
                            overlayClassName,
                        )}
                    />
                    <DrawerPrimitive.Viewport
                        className="fixed inset-0 z-50 flex touch-none items-end justify-center"
                        data-modal-drawer-viewport
                    >
                        <DrawerPrimitive.Popup
                            {...(hasDescription
                                ? {}
                                : { 'aria-describedby': undefined })}
                            className={cx(
                                'fixed inset-x-0 bottom-0 z-50 mt-4 flex max-h-[calc(100dvh-1rem)] w-full max-w-full min-w-0 touch-none flex-col overflow-hidden rounded-t-[10px] border bg-background outline-hidden [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-300 ease-out data-[swiping]:select-none data-[swiping]:duration-0 data-[starting-style]:[transform:translateY(calc(100%+2px))] data-[ending-style]:[transform:translateY(calc(100%+2px))] data-[ending-style]:duration-[calc(var(--drawer-swipe-strength,1)*300ms)] motion-reduce:!animate-none motion-reduce:!transition-none motion-reduce:!duration-0',
                                className,
                            )}
                            {...rest}
                        >
                            <DrawerPrimitive.Title className="sr-only">
                                {title}
                            </DrawerPrimitive.Title>
                            {hasDescription ? (
                                <DrawerPrimitive.Description className="sr-only">
                                    {description}
                                </DrawerPrimitive.Description>
                            ) : null}
                            <div
                                aria-hidden
                                className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted"
                                data-modal-drawer-handle
                            />
                            <DrawerPrimitive.Content
                                className="min-h-0 min-w-0 max-w-full flex-1 touch-auto overflow-x-auto overflow-y-auto overscroll-contain p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] [overflow-wrap:anywhere]"
                                data-modal-scroll-content
                            >
                                {children}
                            </DrawerPrimitive.Content>
                        </DrawerPrimitive.Popup>
                    </DrawerPrimitive.Viewport>
                </DrawerPrimitive.Portal>
            </DrawerPrimitive.VirtualKeyboardProvider>
        </DrawerPrimitive.Root>
    );
}

function useViewport() {
    const [viewport, setViewport] = useState<
        { width: number; height: number } | undefined
    >(undefined);

    useLayoutEffect(() => {
        function updateViewport() {
            setViewport({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        }

        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    return viewport;
}

function hasAccessibleDescription(description: ReactNode) {
    return (
        description !== undefined &&
        description !== null &&
        description !== false &&
        description !== ''
    );
}
