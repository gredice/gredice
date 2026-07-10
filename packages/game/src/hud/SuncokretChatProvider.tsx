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
    closeChat: () => void;
    open: boolean;
    openChat: (target: SuncokretChatTarget) => void;
    target: SuncokretChatTarget | null;
    toggleDefaultChat: () => void;
};

const SuncokretChatContext = createContext<SuncokretChatController | null>(
    null,
);

export function SuncokretChatProvider({ children }: PropsWithChildren) {
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<SuncokretChatTarget | null>(null);

    const closeChat = useCallback(() => setOpen(false), []);
    const openChat = useCallback((nextTarget: SuncokretChatTarget) => {
        setTarget(nextTarget);
        setOpen(true);
    }, []);
    const toggleDefaultChat = useCallback(() => {
        if (open) {
            setOpen(false);
            return;
        }

        setTarget(null);
        setOpen(true);
    }, [open]);
    const value = useMemo(
        () => ({ closeChat, open, openChat, target, toggleDefaultChat }),
        [closeChat, open, openChat, target, toggleDefaultChat],
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
