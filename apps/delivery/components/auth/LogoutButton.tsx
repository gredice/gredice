'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { LogOut } from '@gredice/ui/icons';
import { useState } from 'react';
import { performDeliveryLogout } from '../../lib/deliveryLogout';

export function LogoutButton({ userId }: { userId: string }) {
    const [loading, setLoading] = useState(false);
    return (
        <IconButton
            title="Odjavi se"
            loading={loading}
            variant="plain"
            onClick={async () => {
                setLoading(true);
                try {
                    await performDeliveryLogout(userId);
                } finally {
                    setLoading(false);
                }
            }}
        >
            <LogOut className="size-4" />
        </IconButton>
    );
}
