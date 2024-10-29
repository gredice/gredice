'use client';

import { Button, ButtonButtonProps } from "@signalco/ui-primitives/Button";
import { startTransition, useState } from "react";

export type ServerActionButtonProps = Omit<ButtonButtonProps, 'onClick'> & {
    onClick?: () => Promise<void>;
};

export function ServerActionButton({ onClick, loading, ...props }: ServerActionButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const handleClick = async () => {
        setIsLoading(true);
        if (onClick)
            startTransition(onClick);
    }

    return (
        <Button onClick={handleClick} type="submit" loading={loading || isLoading} {...props} />
    );
}