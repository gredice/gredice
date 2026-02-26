import { auth } from '../../../lib/auth/auth';
import { AdminDashboardClient } from './AdminDashboardClient';
import { getAnalyticsData } from './actions';

type AdminDashboardProps = {
    searchParams?: Promise<{ period?: string; from?: string; to?: string }>;
};

export async function AdminDashboard({ searchParams }: AdminDashboardProps) {
    auth(['admin']);
    const params = await searchParams;
    const selectedPeriod = params?.period || '7';

    const data = await getAnalyticsData(
        selectedPeriod === 'custom' ? undefined : Number(selectedPeriod),
        params?.from,
        params?.to,
    );

    return (
        <AdminDashboardClient
            initialAnalyticsData={data.analytics}
            initialEntitiesData={data.entities}
            initialOperationsDurationData={data.operationsDuration}
            initialWeekdayRegistrations={data.weekdayRegistrations}
            initialPeriod={selectedPeriod}
            initialFrom={params?.from}
            initialTo={params?.to}
        />
    );
}
