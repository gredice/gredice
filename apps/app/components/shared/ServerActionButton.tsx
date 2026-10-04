'use client';

import { Button, type ButtonButtonProps } from '@gredice/ui/Button';
import { useState } from 'react';

export type ServerActionButtonProps = Omit<ButtonButtonProps, 'onClick'> & {
    onClick?: () => Promise<void>;
};

export function ServerActionButton({
    onClick,
    loading,
    ...props
}: ServerActionButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const handleClick = async () => {
        setIsLoading(true);
        if (onClick) await onClick();
        setIsLoading(false);
    };

    return (
        <Button
            onClick={handleClick}
            type="submit"
            loading={loading || isLoading}
            {...props}
        />
    );
}
