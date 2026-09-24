import { Popper } from '@gredice/ui/Popper';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const desktopChatQuery = '(min-width: 768px)';

function subscribeToDesktopChatLayout(onChange: () => void) {
    const mediaQuery = window.matchMedia(desktopChatQuery);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
}

function desktopChatLayoutSnapshot() {
    return window.matchMedia(desktopChatQuery).matches;
}

export function SuncokretChatPositioner({
    anchorElement,
    children,
    isCloseup,
    onClose,
}: {
    anchorElement: HTMLElement | null;
    children: ReactNode;
    isCloseup: boolean;
    onClose: () => void;
}) {
    const desktop = useSyncExternalStore(
        subscribeToDesktopChatLayout,
        desktopChatLayoutSnapshot,
        () => false,
    );
    const virtualRef = useMemo(
        () => (anchorElement ? { current: anchorElement } : undefined),
        [anchorElement],
    );

    if (desktop && anchorElement?.isConnected && virtualRef) {
        const anchorRect = anchorElement.getBoundingClientRect();
        const anchorCenter = anchorRect.left + anchorRect.width / 2;
        const side = anchorCenter < window.innerWidth / 2 ? 'right' : 'left';

        return (
            <Popper
                align="center"
                className="z-[60] !w-[440px] max-w-[calc(100vw-var(--game-safe-area-left,0px)-var(--game-safe-area-right,0px)-1rem)] border-0 bg-transparent p-0 shadow-none"
                data-suncokret-placement="anchored"
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        onClose();
                    }
                }}
                open
                positionerClassName="z-[60] data-[base-ui-inert]:pointer-events-none data-[base-ui-inert]:z-40"
                side={side}
                sideOffset={12}
                virtualRef={virtualRef}
            >
                {children}
            </Popper>
        );
    }

    return createPortal(
        <div
            className={cx(
                'pointer-events-auto fixed bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] right-[calc(var(--game-safe-area-right,0px)+0.5rem)] z-[60] flex justify-center md:block',
                isCloseup
                    ? 'md:right-auto md:left-[calc(var(--game-safe-area-left,0px)+0.5rem)]'
                    : 'md:right-[calc(var(--game-safe-area-right,0px)+0.5rem)] md:left-auto',
            )}
            data-suncokret-placement={
                isCloseup ? 'bottom-left' : 'bottom-right'
            }
        >
            {children}
        </div>,
        document.body,
    );
}
