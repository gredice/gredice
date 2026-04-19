import { getEntityTypes, getSetting, SettingsKeys } from '@gredice/storage';
import { auth } from '../../../lib/auth/auth';
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
    auth(['admin']);
    const params = await searchParams;
    const selectedPeriod = params?.period || '7';

    const [data, entityTypes, dashboardQuickActionsSetting] = await Promise.all(
        [
            getAnalyticsData(
                selectedPeriod === 'custom'
                    ? undefined
                    : Number(selectedPeriod),
                params?.from,
                params?.to,
            ),
            getEntityTypes(),
            getSetting(SettingsKeys.DashboardQuickActions),
        ],
    );

    const quickActionOptions = buildDashboardQuickActionOptions(
        entityTypes.map((entityType) => ({
            name: entityType.name,
            label: entityType.label,
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
            initialWeekdayRegistrations={data.weekdayRegistrations}
            initialAiData={data.ai}
            initialQuickActions={quickActions}
            initialPeriod={selectedPeriod}
            initialFrom={params?.from}
            initialTo={params?.to}
        />
    );
}
