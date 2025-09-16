'use client';

import { authCurrentUserQueryKeys } from '@signalco/auth-client';
import { LogOut } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { queryClient } from '../providers/ClientAppProvider';

export function LogoutButton() {
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

            localStorage.removeItem('gredice-token');
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
        <Button
            variant="outlined"
            startDecorator={<LogOut className="size-4" />}
            loading={loading}
            onClick={handleLogout}
        >
            Odjavi se
        </Button>
    );
}
