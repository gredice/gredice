import 'server-only';

import {
    getCmsPagesReadyForReviewCount,
    getPendingAchievementsCount,
    getSetting,
    SettingsKeys,
} from '@gredice/storage';
import { adminRequestRead } from './adminRequestReads';

export const getAdminCmsReviewCount = adminRequestRead(
    'navigation.cms-review-count',
    getCmsPagesReadyForReviewCount,
);
export const getAdminPendingAchievementsCount = adminRequestRead(
    'navigation.achievement-count',
    getPendingAchievementsCount,
);
export const getAdminDashboardQuickActionsSetting = adminRequestRead(
    'navigation.quick-actions-setting',
    () => getSetting(SettingsKeys.DashboardQuickActions),
);
