'use client';

import type { getEntityTypesOrganizedByCategories } from '@gredice/storage';
import { createContext } from 'react';

export type NavContextType = Awaited<
    ReturnType<typeof getEntityTypesOrganizedByCategories>
> & {
    pendingAchievementsCount: number;
};

export const NavContext = createContext<NavContextType | undefined>(undefined);
