'use client';

import { authCurrentUserQueryKeys } from '@gredice/ui/auth';
import { IconButton } from '@gredice/ui/IconButton';
import { LogOut } from '@gredice/ui/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { queryClient } from '../providers/ClientAppProvider';

export function LogoutButton({
    size = 'md',
}: {
    size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (!response.ok) {
                console.error('Logout failed with status', response.status);
                return;
            }

            await queryClient.invalidateQueries({
                queryKey: authCurrentUserQueryKeys,
            });
            router.refresh();
        } catch (cause) {
            console.error('Logout request failed', cause);
        } finally {
            setLoading(false);
        }
    };

    return (
        <IconButton
            title="Odjavi se"
            variant="plain"
            size={size}
            loading={loading}
            onClick={handleLogout}
            className="whitespace-nowrap"
        >
            <LogOut className="size-4 shrink-0" />
        </IconButton>
    );
}
