'use client';

import { Close, Menu } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useState } from 'react';
import { Nav } from './Nav';

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);

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

            {/* Sidebar */}
            <div
                className={`fixed top-0 left-0 h-full w-80 max-w-[80vw] bg-background border-r z-50 md:hidden transform transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <Typography level="h4" semiBold>
                            Administracija
                        </Typography>
                        <IconButton
                            variant="plain"
                            title="Zatvori"
                            onClick={() => setIsOpen(false)}
                        >
                            <Close className="size-4" />
                        </IconButton>
                    </div>
                    {/* Navigation */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <Nav onItemClick={() => setIsOpen(false)} />
                    </div>
                </div>
            </div>
        </>
    );
}
