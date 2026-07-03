'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

let pendingRouteViewTransitionResolve: (() => void) | null = null;

function resolvePendingRouteViewTransition() {
    const resolve = pendingRouteViewTransitionResolve;
    if (!resolve) {
        return;
    }

    pendingRouteViewTransitionResolve = null;
    resolve();
}

function supportsPublicGardenViewTransition() {
    return (
        typeof document !== 'undefined' &&
        typeof document.startViewTransition === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

export function startPublicGardenViewTransition(navigate: () => void) {
    if (!supportsPublicGardenViewTransition()) {
        navigate();
        return;
    }

    resolvePendingRouteViewTransition();

    const transition = document.startViewTransition(
        () =>
            new Promise<void>((resolve) => {
                let settled = false;
                const settle = () => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    window.clearTimeout(timeout);
                    window.requestAnimationFrame(() => resolve());
                };
                const timeout = window.setTimeout(settle, 1200);

                pendingRouteViewTransitionResolve = settle;
                navigate();
            }),
    );

    transition.finished.catch(() => {
        resolvePendingRouteViewTransition();
    });
}

export function PublicGardenViewTransitionProvider() {
    const pathname = usePathname();

    useEffect(() => {
        if (pathname) {
            resolvePendingRouteViewTransition();
        }
    }, [pathname]);

    return null;
}
