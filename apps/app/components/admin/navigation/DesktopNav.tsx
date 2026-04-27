'use client';

import { ArrowLeft, ArrowRight } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useEffect, useState } from 'react';
import { Nav } from './Nav';

export function DesktopNav() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLargeScreen, setIsLargeScreen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const handleChange = () => setIsLargeScreen(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const compact = !isExpanded && !isLargeScreen;

    return (
        <aside
            className={`hidden md:block md:shrink-0 md:transition-[width] md:duration-200 ${
                isExpanded ? 'md:w-72' : 'md:w-20'
            } lg:w-72`}
        >
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border bg-background/95 p-2 shadow-sm lg:p-3">
                <div className="mb-2 flex items-center justify-end lg:hidden">
                    <IconButton
                        variant="plain"
                        onClick={() => setIsExpanded((value) => !value)}
                        title={
                            isExpanded
                                ? 'Sažmi bočnu navigaciju'
                                : 'Proširi bočnu navigaciju'
                        }
                        className="rounded-md border"
                    >
                        {isExpanded ? (
                            <ArrowLeft className="size-4" />
                        ) : (
                            <ArrowRight className="size-4" />
                        )}
                    </IconButton>
                </div>

                <Nav compact={compact} />
            </div>
        </aside>
    );
}
