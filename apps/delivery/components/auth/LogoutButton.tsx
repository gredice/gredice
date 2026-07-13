'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { LogOut } from '@gredice/ui/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    return (
        <IconButton
            title="Odjavi se"
            loading={loading}
            variant="plain"
            onClick={async () => {
                setLoading(true);
                try {
                    await fetch('/api/logout', { method: 'POST' });
                    router.refresh();
                } finally {
                    setLoading(false);
                }
            }}
        >
            <LogOut className="size-4" />
        </IconButton>
    );
}
