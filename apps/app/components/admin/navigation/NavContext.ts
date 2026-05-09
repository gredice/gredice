'use client';

import type { getEntityTypesOrganizedByCategories } from '@gredice/storage';
import { createContext } from 'react';
import type { DashboardQuickActionOption } from '../../../src/dashboardQuickActions';

export type NavContextType = Awaited<
    ReturnType<typeof getEntityTypesOrganizedByCategories>
> & {
    pendingAchievementsCount: number;
    quickActions: DashboardQuickActionOption[];
};

export const NavContext = createContext<NavContextType | undefined>(undefined);
