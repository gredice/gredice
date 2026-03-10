'use client';

import { NavContext, type NavContextType } from '../navigation/NavContext';

export function AdminClientProvider({
    categorizedTypes,
    uncategorizedTypes,
    shadowTypes,
    pendingAchievementsCount,
    children,
}: {
    categorizedTypes: NavContextType['categorizedTypes'];
    uncategorizedTypes: NavContextType['uncategorizedTypes'];
    shadowTypes: NavContextType['shadowTypes'];
    pendingAchievementsCount: number;
    children: React.ReactNode;
}) {
    return (
        <NavContext.Provider
            value={{ categorizedTypes, uncategorizedTypes, shadowTypes, pendingAchievementsCount }}
        >
            {children}
        </NavContext.Provider>
    );
}
