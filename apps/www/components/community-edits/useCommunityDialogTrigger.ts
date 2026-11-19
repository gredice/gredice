'use client';

import {
    type MouseEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

/**
 * Open state for a community dialog that is mounted on demand.
 *
 * The sign-in dialog and the form take turns for the same trigger, so the
 * dialog that closes last may not know where focus came from. After closing,
 * focus goes back to the trigger unless something else already took it.
 */
export function useCommunityDialogTrigger() {
    const [open, setOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const triggerElementRef = useRef<HTMLButtonElement | null>(null);
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (open) {
            wasOpenRef.current = true;
            return;
        }
        if (!wasOpenRef.current) {
            return;
        }
        wasOpenRef.current = false;

        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
                const activeElement = document.activeElement;
                if (!activeElement || activeElement === document.body) {
                    triggerElementRef.current?.focus({ preventScroll: true });
                }
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [open]);

    const openDialog = useCallback(() => {
        setHasOpened(true);
        setOpen(true);
    }, []);

    function handleTriggerClick(event: MouseEvent<HTMLButtonElement>) {
        // The dialog mounts on demand. Keep its return-focus target stable,
        // including in browsers that do not focus buttons on pointer clicks.
        triggerElementRef.current = event.currentTarget;
        event.currentTarget.focus({ preventScroll: true });
        openDialog();
    }

    return { handleTriggerClick, hasOpened, open, openDialog, setOpen };
}
