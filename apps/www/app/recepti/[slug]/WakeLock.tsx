'use client';

import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { useState } from 'react';

export function WakeLock() {
    const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

    const requestWakeLock = async () => {
        try {
            const wl = await navigator.wakeLock?.request?.('screen');
            // Some browsers might not support Wake Lock
            if (!wl) return;
            setWakeLock(wl);
            wl.addEventListener('release', () => {
                setWakeLock(null);
            });
        } catch {
            // the wake lock request fails - usually system related, such being low on battery
        }
    };

    const releaseWakeLock = async () => {
        try {
            await wakeLock?.release();
        } catch {
            // ignore
        }
        setWakeLock(null);
    };

    const handleToggleWakeLock = (newChecked: boolean) => {
        if (newChecked) {
            releaseWakeLock();
        } else {
            requestWakeLock();
        }
    };

    return (
        <div className="block sm:hidden">
            <Checkbox
                label="Ne gasi ekran"
                className="bg-card"
                checked={wakeLock !== null}
                onCheckedChange={handleToggleWakeLock}
            />
        </div>
    );
}
