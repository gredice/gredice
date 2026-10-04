'use client';

import { AdminTitleProvider } from '../navigation/AdminTitleProvider';
import { NavContext, type NavContextType } from '../navigation/NavContext';

export function AdminClientProvider({
    categorizedTypes,
    uncategorizedTypes,
    shadowTypes,
    pendingCmsPagesReviewCount,
    pendingAchievementsCount,
    pendingApprovalTasksCount,
    pendingCommunityEditRequestsCount,
    quickActions,
    children,
}: {
    categorizedTypes: NavContextType['categorizedTypes'];
    uncategorizedTypes: NavContextType['uncategorizedTypes'];
    shadowTypes: NavContextType['shadowTypes'];
    pendingCmsPagesReviewCount: number;
    pendingAchievementsCount: number;
    pendingApprovalTasksCount: number;
    pendingCommunityEditRequestsCount: number;
    quickActions: NavContextType['quickActions'];
    children: React.ReactNode;
}) {
    return (
        <NavContext.Provider
            value={{
                categorizedTypes,
                uncategorizedTypes,
                shadowTypes,
                pendingCmsPagesReviewCount,
                pendingAchievementsCount,
                pendingApprovalTasksCount,
                pendingCommunityEditRequestsCount,
                quickActions,
            }}
        >
            <AdminTitleProvider>{children}</AdminTitleProvider>
        </NavContext.Provider>
    );
}
