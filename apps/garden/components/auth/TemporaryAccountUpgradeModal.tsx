'use client';

import { temporaryAccountUpgradeRequiredEvent } from '@gredice/game';
import { useEffect, useState } from 'react';
import LoginModal from './LoginModal';

export function TemporaryAccountUpgradeModal() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        function handleUpgradeRequired() {
            setOpen(true);
        }

        window.addEventListener(
            temporaryAccountUpgradeRequiredEvent,
            handleUpgradeRequired,
        );
        return () =>
            window.removeEventListener(
                temporaryAccountUpgradeRequiredEvent,
                handleUpgradeRequired,
            );
    }, []);

    return (
        <LoginModal
            defaultTab="register"
            description="Za plaćanje trebamo potvrditi račun. Tvoj vrt, košara i favoriti ostaju spremljeni."
            dismissible
            onOpenChange={setOpen}
            open={open}
            registrationSuccessHref="/prijava/registracija-uspijesna?upgrade=1"
            showBanner={false}
            title="Spremi račun za plaćanje"
        />
    );
}
