'use client';

import { temporaryAccountLoginRequestedEvent } from '@gredice/game';
import { useEffect, useState } from 'react';
import LoginModal from './LoginModal';

export function TemporaryAccountLoginModal() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        function handleLoginRequested() {
            setOpen(true);
        }

        window.addEventListener(
            temporaryAccountLoginRequestedEvent,
            handleLoginRequested,
        );
        return () =>
            window.removeEventListener(
                temporaryAccountLoginRequestedEvent,
                handleLoginRequested,
            );
    }, []);

    return (
        <LoginModal
            defaultTab="login"
            description="Prijavi se kako bi otvorio postojeći vrt. Napredak iz privremenog vrta ostat će spremljen na tvom računu."
            dismissible
            onOpenChange={setOpen}
            open={open}
            showBanner={false}
            title="Prijava u postojeći vrt"
        />
    );
}
