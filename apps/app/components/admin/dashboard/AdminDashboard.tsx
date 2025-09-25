import { redirect } from 'next/navigation';
import { auth } from '../../../lib/auth/auth';
import { AdminDashboardClient } from './AdminDashboardClient';
import { getAnalyticsData } from './actions';

type AdminDashboardProps = {
    searchParams?: Promise<{ period?: string }>;
};

export async function AdminDashboard({ searchParams }: AdminDashboardProps) {
    auth(['admin']);
    const params = await searchParams;
    const selectedPeriod = params?.period || '7';

    const data = await getAnalyticsData(Number(selectedPeriod));

    const handlePeriodChange = async (period: string) => {
        'use server';
        auth(['admin']);
        redirect(`?period=${period}`);
    };

    return (
        <AdminDashboardClient
            initialAnalyticsData={data.analytics}
            initialEntitiesData={data.entities}
            initialOperationsDurationData={data.operationsDuration}
            onPeriodChange={handlePeriodChange}
            initialPeriod={selectedPeriod}
        />
    );
}
