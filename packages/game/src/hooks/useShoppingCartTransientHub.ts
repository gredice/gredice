import { useEffect, useState } from 'react';

const HUB_HIDE_DELAY_MS = 3000;

let transientVisible = false;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<(visible: boolean) => void>();

function notify() {
    for (const listener of listeners) {
        listener(transientVisible);
    }
}

export function showShoppingCartTransientHub() {
    transientVisible = true;
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }
    notify();
}

export function scheduleHideShoppingCartTransientHub() {
    if (hideTimer) {
        clearTimeout(hideTimer);
    }

    hideTimer = setTimeout(() => {
        transientVisible = false;
        hideTimer = null;
        notify();
    }, HUB_HIDE_DELAY_MS);
}

export function useShoppingCartTransientHub(isShoppingCartOpen: boolean) {
    const [visible, setVisible] = useState(transientVisible);

    useEffect(() => {
        listeners.add(setVisible);
        return () => {
            listeners.delete(setVisible);
        };
    }, []);

    useEffect(() => {
        if (isShoppingCartOpen && transientVisible) {
            transientVisible = false;
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            notify();
        }
    }, [isShoppingCartOpen]);

    return visible;
}
