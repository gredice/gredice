export type DocumentVisibilityTarget = {
    readonly hidden: boolean;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
};

export type PageVisibilityTarget = {
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
};

export function observeDocumentVisibility({
    documentTarget,
    onVisibilityChange,
    windowTarget,
}: {
    documentTarget: DocumentVisibilityTarget;
    onVisibilityChange: (visible: boolean) => void;
    windowTarget: PageVisibilityTarget;
}) {
    const syncVisibility = () => onVisibilityChange(!documentTarget.hidden);
    const handlePageHide = () => onVisibilityChange(false);

    documentTarget.addEventListener('visibilitychange', syncVisibility);
    windowTarget.addEventListener('pagehide', handlePageHide);
    windowTarget.addEventListener('pageshow', syncVisibility);
    syncVisibility();

    let observing = true;
    return () => {
        if (!observing) {
            return;
        }
        observing = false;
        documentTarget.removeEventListener('visibilitychange', syncVisibility);
        windowTarget.removeEventListener('pagehide', handlePageHide);
        windowTarget.removeEventListener('pageshow', syncVisibility);
    };
}
