'use client';

import { NavContext, NavContextType } from "../navigation/NavContext";

export function AdminClientProvider({ categorizedTypes, uncategorizedTypes, children }: {
    categorizedTypes: NavContextType['categorizedTypes'],
    uncategorizedTypes: NavContextType['uncategorizedTypes'],
    children: React.ReactNode
}) {

    return (
        <NavContext.Provider value={{ categorizedTypes, uncategorizedTypes }}>
            {children}
        </NavContext.Provider>
    );
}
