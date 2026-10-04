'use client';

import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import type { FormEvent, HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { isValidElement, useEffect, useState } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Row } from '../Row';
import { Stack } from '../Stack';
import { Typography } from '../Typography';
import { cx } from '../utils';

export type ModalConfirmNoPromptProps = {
    header: ReactNode;
    promptLabel?: never;
    expectedConfirm?: never;
    onConfirm?: () => void;
};

export type ModalConfirmPromptProps = {
    header: ReactNode;
    promptLabel?: string;
    expectedConfirm: string;
    onConfirm?: () => void;
};

type ModalConfirmBaseProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
    title: string;
    description?: ReactNode;
    trigger?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    cancelLabel?: ReactNode;
    confirmLabel?: ReactNode;
    modal?: boolean;
    hideClose?: boolean;
    disableMobile?: boolean;
    mobileOverride?: boolean;
    dismissible?: boolean;
};

export type ModalConfirmProps = ModalConfirmBaseProps &
    (ModalConfirmNoPromptProps | ModalConfirmPromptProps);

export function ModalConfirm({
    cancelLabel = 'Odustani',
    children,
    className,
    confirmLabel = 'Potvrdi',
    description,
    disableMobile: _disableMobile,
    dismissible: _dismissible,
    expectedConfirm,
    header,
    hideClose: _hideClose,
    mobileOverride: _mobileOverride,
    modal: _modal,
    onConfirm,
    onOpenChange,
    open,
    promptLabel,
    title,
    trigger,
    ...rest
}: ModalConfirmProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [promptValue, setPromptValue] = useState('');
    const currentOpen = open ?? internalOpen;
    const canConfirm = !expectedConfirm || promptValue === expectedConfirm;
    const hasExplicitDescription = hasAccessibleDescription(description);
    const useChildrenAsDescription =
        !hasExplicitDescription &&
        typeof children === 'string' &&
        children.trim().length > 0;
    const hiddenDescription = hasExplicitDescription ? description : title;
    const triggerRender = isValidElement(trigger) ? trigger : undefined;

    useEffect(() => {
        if (!currentOpen) {
            setPromptValue('');
        }
    }, [currentOpen]);

    function setOpen(nextOpen: boolean) {
        if (open === undefined) {
            setInternalOpen(nextOpen);
        }

        onOpenChange?.(nextOpen);
    }

    function confirm() {
        if (!canConfirm) {
            return;
        }

        setOpen(false);
        onConfirm?.();
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        confirm();
    }

    function handleConfirmClick(event: MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        confirm();
    }

    return (
        <AlertDialogPrimitive.Root onOpenChange={setOpen} open={currentOpen}>
            {trigger ? (
                <AlertDialogPrimitive.Trigger render={triggerRender}>
                    {triggerRender ? undefined : trigger}
                </AlertDialogPrimitive.Trigger>
            ) : null}
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-background/80 backdrop-blur-xs data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 motion-reduce:animate-none motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute" />
                <AlertDialogPrimitive.Viewport className="pointer-events-none fixed inset-0 z-50">
                    <AlertDialogPrimitive.Popup
                        className={cx(
                            'pointer-events-auto fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[starting-style]:zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 motion-reduce:animate-none motion-reduce:transition-none sm:rounded-lg md:w-full',
                            className,
                        )}
                        {...rest}
                    >
                        <form onSubmit={handleSubmit}>
                            <Stack spacing={8}>
                                <Stack spacing={4}>
                                    <AlertDialogPrimitive.Title
                                        render={
                                            typeof header === 'string' ? (
                                                <Typography level="h5" />
                                            ) : (
                                                <div />
                                            )
                                        }
                                    >
                                        {header}
                                    </AlertDialogPrimitive.Title>
                                    {!useChildrenAsDescription ? (
                                        <AlertDialogPrimitive.Description className="sr-only">
                                            {hiddenDescription}
                                        </AlertDialogPrimitive.Description>
                                    ) : null}
                                    {typeof children === 'string' ? (
                                        useChildrenAsDescription ? (
                                            <AlertDialogPrimitive.Description
                                                render={
                                                    <Typography level="body1" />
                                                }
                                            >
                                                {children}
                                            </AlertDialogPrimitive.Description>
                                        ) : (
                                            <Typography level="body1">
                                                {children}
                                            </Typography>
                                        )
                                    ) : (
                                        children
                                    )}
                                    {expectedConfirm ? (
                                        <Input
                                            autoFocus
                                            label={promptLabel}
                                            onChange={(event) =>
                                                setPromptValue(
                                                    event.target.value,
                                                )
                                            }
                                            value={promptValue}
                                        />
                                    ) : null}
                                </Stack>
                                <Row justifyContent="end" spacing={2}>
                                    <AlertDialogPrimitive.Close
                                        render={
                                            <Button
                                                type="button"
                                                variant="plain"
                                            />
                                        }
                                    >
                                        {cancelLabel}
                                    </AlertDialogPrimitive.Close>
                                    <Button
                                        disabled={!canConfirm}
                                        type="submit"
                                        onClick={handleConfirmClick}
                                    >
                                        {confirmLabel}
                                    </Button>
                                </Row>
                            </Stack>
                        </form>
                    </AlertDialogPrimitive.Popup>
                </AlertDialogPrimitive.Viewport>
            </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
    );
}

function hasAccessibleDescription(description: ReactNode) {
    return (
        description !== undefined &&
        description !== null &&
        description !== false &&
        description !== ''
    );
}
