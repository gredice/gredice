'use client';

import { type ReactNode, useSyncExternalStore } from 'react';

const desktopLayoutQuery = '(min-width: 768px)';

function subscribeToDesktopLayout(onChange: () => void) {
    const mediaQuery = window.matchMedia(desktopLayoutQuery);
    mediaQuery.addEventListener('change', onChange);

    return () => mediaQuery.removeEventListener('change', onChange);
}

function desktopLayoutSnapshot() {
    return window.matchMedia(desktopLayoutQuery).matches;
}

export function RaisedBedResponsiveLayout({
    children,
    layout,
}: {
    children: ReactNode;
    layout: 'mobile' | 'desktop';
}) {
    const desktop = useSyncExternalStore(
        subscribeToDesktopLayout,
        desktopLayoutSnapshot,
        () => false,
    );
    const activeLayout = desktop ? 'desktop' : 'mobile';

    return layout === activeLayout ? children : null;
}
