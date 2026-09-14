'use client';

import {
    notifyTemporaryAccountLoginOpenChanged,
    temporaryAccountLoginRequestedEvent,
} from '@gredice/game';
import { useEffect, useState } from 'react';
import LoginModal from './LoginModal';

export function TemporaryAccountLoginModal() {
    const [open, setOpen] = useState(false);
    const [requestedByUrl, setRequestedByUrl] = useState(false);

    useEffect(() => {
        const requested =
            new URL(window.location.href).searchParams.get('prijava') === '1';
        if (!requested) {
            return;
        }

        setRequestedByUrl(true);
        setOpen(true);
    }, []);

    useEffect(() => {
        function handleLoginRequested(event: Event) {
            event.preventDefault();
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

    useEffect(() => {
        notifyTemporaryAccountLoginOpenChanged(open);
    }, [open]);

    useEffect(() => {
        return () => notifyTemporaryAccountLoginOpenChanged(false);
    }, []);

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (nextOpen || !requestedByUrl) {
            return;
        }

        const url = new URL(window.location.href);
        url.searchParams.delete('prijava');
        setRequestedByUrl(false);
        window.history.replaceState(
            window.history.state,
            '',
            `${url.pathname}${url.search}${url.hash}`,
        );
    }

    if (!open) {
        return null;
    }

    return (
        <LoginModal
            defaultTab="login"
            description="Prijava otvara tvoj postojeći vrt bez dodavanja privremenog računa. Registracijom spremaš privremeni vrt kao novi račun."
            dismissible
            onOpenChange={handleOpenChange}
            open={open}
            showBanner={false}
            title="Prijava u postojeći vrt"
        />
    );
}
