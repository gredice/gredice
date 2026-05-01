'use client';

import { Close, Menu } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Nav } from './Nav';

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const [portalElement, setPortalElement] = useState<HTMLElement | null>(
        null,
    );

    useEffect(() => {
        setPortalElement(document.body);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
        }

        return () => {
            document.body.classList.remove('overflow-hidden');
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const drawer = (
        <>
            <div
                className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200 md:hidden ${
                    isOpen
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none opacity-0'
                }`}
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
            />

            <aside
                className={`fixed inset-y-0 left-0 z-[60] flex w-[88vw] max-w-[22rem] flex-col border-r bg-background shadow-xl transition-transform duration-300 ease-out md:hidden ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                aria-label="Administracijski izbornik"
            >
                <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <Typography
                                level="h4"
                                semiBold
                                className="truncate"
                            >
                                Administracija
                            </Typography>
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Navigacija i upravljanje
                            </Typography>
                        </div>
                        <IconButton
                            variant="plain"
                            title="Zatvori"
                            onClick={() => setIsOpen(false)}
                            className="rounded-md border"
                        >
                            <Close className="size-4" />
                        </IconButton>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-4">
                    <Nav
                        idPrefix="mobile-admin-nav"
                        onItemClick={() => setIsOpen(false)}
                    />
                </div>
            </aside>
        </>
    );

    return (
        <>
            <IconButton
                variant="plain"
                onClick={() => setIsOpen(true)}
                title="Otvori izbornik"
                className="md:hidden"
            >
                <Menu className="size-4" />
            </IconButton>

            {portalElement ? createPortal(drawer, portalElement) : null}
        </>
    );
}
