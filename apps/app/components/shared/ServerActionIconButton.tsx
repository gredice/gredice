'use client';

import { IconButton, IconButtonProps } from "@signalco/ui-primitives/IconButton";
import { startTransition, useState } from "react";

export type ServerActionIconButtonProps = Omit<IconButtonProps, 'onClick'> & {
    onClick?: () => Promise<void>;
};

export function ServerActionIconButton({ onClick, loading, ...props }: ServerActionIconButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const handleClick = async () => {
        setIsLoading(true);
        if (onClick)
            startTransition(onClick);
    }


    return (
        <IconButton
            {...props}
            onClick={handleClick}
            loading={loading || isLoading}
            type="submit" />
    );
}