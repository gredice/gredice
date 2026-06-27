'use client';

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type { FormEvent, HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
                <AlertDialogPrimitive.Trigger asChild>
                    {trigger}
                </AlertDialogPrimitive.Trigger>
            ) : null}
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <AlertDialogPrimitive.Content
                    className={cx(
                        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] data-[state=open]:zoom-in-95 sm:rounded-lg md:w-full',
                        className,
                    )}
                    {...rest}
                >
                    <form onSubmit={handleSubmit}>
                        <Stack spacing={8}>
                            <Stack spacing={4}>
                                <AlertDialogPrimitive.Title asChild>
                                    {typeof header === 'string' ? (
                                        <Typography level="h5">
                                            {header}
                                        </Typography>
                                    ) : (
                                        <div>{header}</div>
                                    )}
                                </AlertDialogPrimitive.Title>
                                {!useChildrenAsDescription ? (
                                    <AlertDialogPrimitive.Description className="sr-only">
                                        {hiddenDescription}
                                    </AlertDialogPrimitive.Description>
                                ) : null}
                                {typeof children === 'string' ? (
                                    useChildrenAsDescription ? (
                                        <AlertDialogPrimitive.Description
                                            asChild
                                        >
                                            <Typography level="body1">
                                                {children}
                                            </Typography>
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
                                            setPromptValue(event.target.value)
                                        }
                                        value={promptValue}
                                    />
                                ) : null}
                            </Stack>
                            <Row justifyContent="end" spacing={2}>
                                <AlertDialogPrimitive.Cancel asChild>
                                    <Button type="button" variant="plain">
                                        {cancelLabel}
                                    </Button>
                                </AlertDialogPrimitive.Cancel>
                                <AlertDialogPrimitive.Action asChild>
                                    <Button
                                        disabled={!canConfirm}
                                        type="submit"
                                        onClick={handleConfirmClick}
                                    >
                                        {confirmLabel}
                                    </Button>
                                </AlertDialogPrimitive.Action>
                            </Row>
                        </Stack>
                    </form>
                </AlertDialogPrimitive.Content>
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
