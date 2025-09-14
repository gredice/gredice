'use client';

import { NavContext, type NavContextType } from '../navigation/NavContext';

export function AdminClientProvider({
    categorizedTypes,
    uncategorizedTypes,
    shadowTypes,
    children,
}: {
    categorizedTypes: NavContextType['categorizedTypes'];
    uncategorizedTypes: NavContextType['uncategorizedTypes'];
    shadowTypes: NavContextType['shadowTypes'];
    children: React.ReactNode;
}) {
    return (
        <NavContext.Provider
            value={{ categorizedTypes, uncategorizedTypes, shadowTypes }}
        >
            {children}
        </NavContext.Provider>
    );
}
