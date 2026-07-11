'use client';

import type { SuncokretUiContext } from '@gredice/js/ai';
import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

export type SuncokretChatTarget = {
    conversationLabel: string;
    gardenId: number | null;
    positionIndex: number | null;
    raisedBedId: number | null;
    uiContext: SuncokretUiContext;
};

type SuncokretChatController = {
    anchorElement: HTMLElement | null;
    closeChat: () => void;
    open: boolean;
    openChat: (target: SuncokretChatTarget, anchorElement: HTMLElement) => void;
    target: SuncokretChatTarget | null;
    toggleDefaultChat: (anchorElement: HTMLElement) => void;
};

const SuncokretChatContext = createContext<SuncokretChatController | null>(
    null,
);

export function SuncokretChatProvider({ children }: PropsWithChildren) {
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<SuncokretChatTarget | null>(null);
    const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(
        null,
    );

    const closeChat = useCallback(() => setOpen(false), []);
    const openChat = useCallback(
        (nextTarget: SuncokretChatTarget, nextAnchorElement: HTMLElement) => {
            setTarget(nextTarget);
            setAnchorElement(nextAnchorElement);
            setOpen(true);
        },
        [],
    );
    const toggleDefaultChat = useCallback(
        (nextAnchorElement: HTMLElement) => {
            if (open) {
                setOpen(false);
                return;
            }

            setTarget(null);
            setAnchorElement(nextAnchorElement);
            setOpen(true);
        },
        [open],
    );
    const value = useMemo(
        () => ({
            anchorElement,
            closeChat,
            open,
            openChat,
            target,
            toggleDefaultChat,
        }),
        [anchorElement, closeChat, open, openChat, target, toggleDefaultChat],
    );

    return (
        <SuncokretChatContext.Provider value={value}>
            {children}
        </SuncokretChatContext.Provider>
    );
}

export function useSuncokretChat() {
    return useContext(SuncokretChatContext);
}
