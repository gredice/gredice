'use client';

import type { ReactNode } from 'react';
import { Toaster, toast } from 'sonner';
import { Button } from '../Button';
import { Row } from '../Row';

export type PageNotificationVariant =
    | 'default'
    | 'info'
    | 'success'
    | 'warning'
    | 'error';

export type PageNotificationOptions = {
    variant?: PageNotificationVariant;
    autoHideDuration?: number;
    persist?: boolean;
    action?: ReactNode;
};

function notificationDuration(options?: PageNotificationOptions) {
    if (options?.persist) {
        return Number.POSITIVE_INFINITY;
    }

    return options?.autoHideDuration;
}

function showPageNotification(text: string, options?: PageNotificationOptions) {
    const content = options?.action ? (
        <Row alignItems="center" justifyContent="space-between" spacing={4}>
            <span>{text}</span>
            {options.action}
        </Row>
    ) : (
        text
    );
    const toastOptions = {
        duration: notificationDuration(options),
    };

    switch (options?.variant) {
        case 'success':
            return toast.success(content, toastOptions);
        case 'warning':
            return toast.warning(content, toastOptions);
        case 'error':
            return toast.error(content, toastOptions);
        default:
            return toast.info(content, toastOptions);
    }
}

export function showNotification(
    text: string,
    variant: PageNotificationVariant = 'default',
) {
    if (variant === 'warning' || variant === 'error') {
        const logger = variant === 'error' ? console.error : console.warn;
        logger(`User presented with ${variant}: ${text}`);
    }

    return showPageNotification(text, {
        autoHideDuration: 5000,
        variant,
    });
}

export function showPrompt(
    text: string,
    variant: PageNotificationVariant | undefined,
    actionLabel: string,
    actionCallback: () => void,
) {
    return showPageNotification(text, {
        action: <Button onClick={actionCallback}>{actionLabel}</Button>,
        persist: true,
        variant,
    });
}

export function hideNotification(key?: string | number) {
    toast.dismiss(key);
}

export function NotificationsContainer({
    theme = 'light',
}: {
    theme?: 'light' | 'dark';
}) {
    return <Toaster theme={theme} />;
}
