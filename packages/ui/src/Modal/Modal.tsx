'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { HTMLAttributes, ReactNode } from 'react';
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
};

export function Modal({
    children,
    className,
    dismissible = true,
    hideClose,
    modal,
    mobileOverride: _mobileOverride,
    disableMobile: _disableMobile,
    onOpenChange,
    open,
    title,
    trigger,
    ...rest
}: ModalProps) {
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
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
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
                        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                            <Close aria-hidden className="size-4" />
                            <span className="sr-only">Zatvori</span>
                        </DialogPrimitive.Close>
                    ) : null}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
