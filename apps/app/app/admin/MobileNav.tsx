'use client';

import { useState, useEffect } from "react";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Menu, Close } from "@signalco/ui-icons";
import { Nav } from "./Nav";
import { Typography } from "@signalco/ui-primitives/Typography";

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            <IconButton
                variant="outlined"
                className="md:hidden"
                title="Otvori meni"
                onClick={() => setIsOpen(true)}
            >
                <Menu className="size-5" />
            </IconButton>

            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Drawer */}
            <div className={`fixed top-0 left-0 h-full w-80 max-w-[80vw] bg-background border-r z-50 md:hidden transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <Typography level="h4" semiBold>Administracija</Typography>
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
