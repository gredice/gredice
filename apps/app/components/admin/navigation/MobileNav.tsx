'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Close, PanelRightClose } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useState } from 'react';
import { Nav } from './Nav';

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const desktop = window.matchMedia('(min-width: 768px)');
        const closeOnDesktop = () => {
            if (desktop.matches) setIsOpen(false);
        };
        desktop.addEventListener('change', closeOnDesktop);
        return () => desktop.removeEventListener('change', closeOnDesktop);
    }, []);

    return (
        <Modal
            open={isOpen}
            onOpenChange={setIsOpen}
            title="Administracijski izbornik"
            disableMobile
            hideClose
            className="left-0 top-0 flex h-dvh max-h-dvh w-[88vw] max-w-[22rem] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:rounded-none"
            overlayClassName="bg-black/40 backdrop-blur-[1px]"
            trigger={
                <IconButton
                    variant="plain"
                    title="Otvori izbornik"
                    className="rounded-md text-muted-foreground hover:text-foreground md:hidden"
                >
                    <PanelRightClose className="size-4" />
                </IconButton>
            }
        >
            <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <Typography level="h4" semiBold className="truncate">
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
            <nav
                aria-label="Administracijski izbornik"
                className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
            >
                <Nav
                    idPrefix="mobile-admin-nav"
                    onItemClick={() => setIsOpen(false)}
                />
            </nav>
        </Modal>
    );
}
