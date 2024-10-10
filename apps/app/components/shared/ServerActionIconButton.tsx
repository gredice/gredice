'use client';

import { IconButton, IconButtonProps } from "@signalco/ui-primitives/IconButton";

export type ServerActionIconButtonProps<TActionProps> = {
    actionProps?: any,
    onClick: (...actionProps: TActionProps[]) => Promise<void>,
} & Omit<IconButtonProps, 'onClick'>;

export function ServerActionIconButton<TActionProps>({ onClick, actionProps, ...props }: ServerActionIconButtonProps<TActionProps>) {
    return (
        <IconButton
            {...props}
            onClick={() => Array.isArray(actionProps) ? onClick(...actionProps) : onClick()} />
    );
}