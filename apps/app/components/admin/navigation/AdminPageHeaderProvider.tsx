'use client';

import { type PropsWithChildren, useState } from 'react';
import { AdminPageHeaderContext } from './AdminPageHeaderContext';

export function AdminPageHeaderProvider({ children }: PropsWithChildren) {
    const [activeHeaderId, setActiveHeaderId] = useState<string | null>(null);
    const [slotElement, setSlotElement] = useState<HTMLDivElement | null>(null);

    return (
        <AdminPageHeaderContext.Provider
            value={{
                activeHeaderId,
                setActiveHeaderId,
                slotElement,
                setSlotElement,
            }}
        >
            {children}
        </AdminPageHeaderContext.Provider>
    );
}
