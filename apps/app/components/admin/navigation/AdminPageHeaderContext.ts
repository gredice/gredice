'use client';

import {
    createContext,
    type Dispatch,
    type SetStateAction,
    useContext,
} from 'react';

type AdminPageHeaderContextValue = {
    activeHeaderId: string | null;
    setActiveHeaderId: Dispatch<SetStateAction<string | null>>;
    slotElement: HTMLDivElement | null;
    setSlotElement: Dispatch<SetStateAction<HTMLDivElement | null>>;
};

export const AdminPageHeaderContext =
    createContext<AdminPageHeaderContextValue | null>(null);

export function useAdminPageHeaderContext() {
    const context = useContext(AdminPageHeaderContext);
    if (!context) {
        throw new Error(
            'useAdminPageHeaderContext must be used within AdminPageHeaderProvider',
        );
    }

    return context;
}
