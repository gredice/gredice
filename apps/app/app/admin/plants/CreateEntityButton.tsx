'use client';

import { IconButton, IconButtonProps } from "@signalco/ui-primitives/IconButton";

export function CreateEntityButton({ onClick, ...props }: { onClick: () => void } & Omit<IconButtonProps, 'onClick'>) {
    return (
        <IconButton
            {...props}
            onClick={() => onClick()} />
    );
}