import { getEntityTypes } from '@gredice/storage';
import { auth } from '../../../lib/auth/auth';
import {
    getAdminCmsReviewCount,
    getAdminDashboardQuickActionsSetting,
    getAdminPendingAchievementsCount,
} from '../../../src/adminNavigationData';
import { getPendingAdminApprovalTaskCount } from '../../../src/approvalTasks';
import {
    buildDashboardQuickActionOptions,
    getDashboardQuickActionsFromConfig,
    getDefaultDashboardQuickActions,
} from '../../../src/dashboardQuickActions';
import { AdminDashboardClient } from './AdminDashboardClient';
import { getAnalyticsData } from './actions';

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
    const [
        data,
        entityTypes,
        dashboardQuickActionsSetting,
        pendingCmsPagesReviewCount,
        pendingAchievementsCount,
        pendingApprovalTasksCount,
    ] = await Promise.all([
        selectedDataPromise,
        getEntityTypes(),
        getAdminDashboardQuickActionsSetting(),
        getAdminCmsReviewCount(),
        getAdminPendingAchievementsCount(),
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
            initialOperationsDurationData={data.operationsDuration}
            initialRegistrations={data.registrationsDaily}
            initialAiData={data.ai}
            initialSunflowersData={data.sunflowers}
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
