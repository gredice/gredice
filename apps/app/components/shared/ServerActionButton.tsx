'use client';

import { Button, ButtonProps } from "@signalco/ui-primitives/Button";

export type ServerActionButtonProps<TActionProps> = {
    actionProps?: any,
    onClick: (...actionProps: TActionProps[]) => Promise<void>,
} & Omit<ButtonProps, 'onClick'>;

export function ServerActionButton<TActionProps>({ onClick, actionProps, ...props }: ServerActionButtonProps<TActionProps>) {
    return (
        <Button
            {...props}
            onClick={() => Array.isArray(actionProps) ? onClick(...actionProps) : onClick()} />
    );
}