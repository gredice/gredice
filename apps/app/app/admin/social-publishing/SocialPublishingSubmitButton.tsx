'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { useFormStatus } from 'react-dom';

type SocialPublishingSubmitButtonProps = {
    children: React.ReactNode;
    pendingLabel: string;
    name?: string;
    value?: string;
    color?: 'primary' | 'danger' | 'success' | 'warning' | 'neutral';
    variant?: 'solid' | 'outlined' | 'plain' | 'soft';
};

export function SocialPublishingSubmitButton({
    children,
    pendingLabel,
    name,
    value,
    color,
    variant,
}: SocialPublishingSubmitButtonProps) {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            name={name}
            value={value}
            color={color}
            variant={variant}
            disabled={pending}
            loading={pending}
        >
            {pending ? pendingLabel : children}
        </Button>
    );
}
