import {
    getCmsPagesReadyForReviewCount,
    getEntityTypes,
    getPendingAchievementsCount,
    getSetting,
    SettingsKeys,
} from '@gredice/storage';
import { resolveCurrentWeekStatisticsPeriod } from '../../../app/admin/statistics/statisticsPeriod';
import { auth } from '../../../lib/auth/auth';
import { getPendingAdminApprovalTaskCount } from '../../../src/approvalTasks';
import {
    buildDashboardQuickActionOptions,
    getDashboardQuickActionsFromConfig,
    getDefaultDashboardQuickActions,
} from '../../../src/dashboardQuickActions';
import { AdminDashboardClient } from './AdminDashboardClient';
import { getAnalyticsData, getDashboardWeeklyStatisticsData } from './actions';

type AdminDashboardProps = {
    searchParams?: Promise<{ period?: string; from?: string; to?: string }>;
};

export async function AdminDashboard({ searchParams }: AdminDashboardProps) {
    await auth(['admin']);
    const params = await searchParams;
    const selectedPeriod = params?.period || '7';
    const selectedDataPromise = getAnalyticsData(
        selectedPeriod === 'custom' ? undefined : Number(selectedPeriod),
        params?.from,
        params?.to,
    );
    const currentWeek = resolveCurrentWeekStatisticsPeriod();
    const weeklyDataPromise = getDashboardWeeklyStatisticsData(
        currentWeek.pickerFrom,
        currentWeek.pickerTo,
    );

    const [
        data,
        weeklyData,
        entityTypes,
        dashboardQuickActionsSetting,
        pendingCmsPagesReviewCount,
        pendingAchievementsCount,
        pendingApprovalTasksCount,
    ] = await Promise.all([
        selectedDataPromise,
        weeklyDataPromise,
        getEntityTypes(),
        getSetting(SettingsKeys.DashboardQuickActions),
        getCmsPagesReadyForReviewCount(),
        getPendingAchievementsCount(),
        getPendingAdminApprovalTaskCount(),
    ]);

    const quickActionOptions = buildDashboardQuickActionOptions(
        entityTypes.map((entityType) => ({
            name: entityType.name,
            label: entityType.label,
            icon: entityType.icon,
        })),
    );

    const configuredQuickActions = getDashboardQuickActionsFromConfig(
        dashboardQuickActionsSetting?.value,
        quickActionOptions,
    );

    const quickActions =
        configuredQuickActions.length > 0
            ? configuredQuickActions
            : getDefaultDashboardQuickActions(quickActionOptions);

    return (
        <AdminDashboardClient
            initialAnalyticsData={data.analytics}
            initialEntitiesData={data.entities}
            initialOperationsDurationData={weeklyData.operationsDuration}
            initialWeekdayRegistrations={weeklyData.weekdayRegistrations}
            initialAiData={data.ai}
            initialSunflowersData={weeklyData.sunflowers}
            initialQuickActions={quickActions}
            initialQuickActionBadgeCounts={{
                pendingCmsPagesReviewCount,
                pendingAchievementsCount,
                pendingApprovalTasksCount,
            }}
            initialPeriod={selectedPeriod}
            initialFrom={params?.from}
            initialTo={params?.to}
        />
    );
}
