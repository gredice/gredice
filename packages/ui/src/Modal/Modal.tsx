'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    type HTMLAttributes,
    type ReactNode,
    useLayoutEffect,
    useState,
} from 'react';
import { Drawer } from 'vaul';
import { Close } from '../icons';
import { cx } from '../utils';

export type ModalProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
    trigger?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    modal?: boolean;
    title: string;
    hideClose?: boolean;
    disableMobile?: boolean;
    mobileOverride?: boolean;
    dismissible?: boolean;
    overlayClassName?: string;
};

export function Modal({
    children,
    className,
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
    function preventDismiss(event: Event) {
        if (!dismissible) {
            event.preventDefault();
        }
    }

    return (
        <DialogPrimitive.Root
            modal={modal}
            onOpenChange={onOpenChange}
            open={open}
        >
            {trigger ? (
                <DialogPrimitive.Trigger asChild>
                    {trigger}
                </DialogPrimitive.Trigger>
            ) : null}
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className={cx(
                        'fixed inset-0 z-50 bg-background/80 backdrop-blur-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
                        overlayClassName,
                    )}
                />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className={cx(
                        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] data-[state=open]:zoom-in-95 sm:rounded-lg md:w-full',
                        className,
                    )}
                    onEscapeKeyDown={preventDismiss}
                    onInteractOutside={preventDismiss}
                    {...rest}
                >
                    <DialogPrimitive.Title className="sr-only">
                        {title}
                    </DialogPrimitive.Title>
                    {children}
                    {dismissible && !hideClose ? (
                        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                            <Close aria-hidden className="size-4" />
                            <span className="sr-only">Zatvori</span>
                        </DialogPrimitive.Close>
                    ) : null}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

function MobileModal({
    children,
    className,
    dismissible = true,
    modal,
    onOpenChange,
    overlayClassName,
    open,
    title,
    trigger,
    ...rest
}: Omit<ModalProps, 'disableMobile' | 'hideClose' | 'mobileOverride'>) {
    return (
        <Drawer.Root
            dismissible={dismissible}
            modal={modal}
            onOpenChange={onOpenChange}
            open={open}
            shouldScaleBackground
        >
            {trigger ? (
                <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
            ) : null}
            <Drawer.Portal>
                <Drawer.Overlay
                    className={cx(
                        'fixed inset-0 z-50 bg-black/50',
                        overlayClassName,
                    )}
                />
                <Drawer.Content
                    className={cx(
                        'fixed inset-x-0 bottom-0 z-50 mt-4 flex max-h-[calc(100dvh-1rem)] flex-col rounded-t-[10px] border bg-background',
                        className,
                    )}
                    {...rest}
                >
                    <Drawer.Title className="sr-only">{title}</Drawer.Title>
                    <Drawer.Handle className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
                    <div className="min-h-0 overflow-y-auto p-4">
                        {children}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
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
