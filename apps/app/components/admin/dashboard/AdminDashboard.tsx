import { auth } from "../../../lib/auth/auth";
import { getAnalyticsData } from "./actions";
import { AdminDashboardClient } from "./AdminDashboardClient";
import { redirect } from "next/navigation";

type AdminDashboardProps = {
    searchParams?: Promise<{ period?: string }>;
};

export async function AdminDashboard({ searchParams }: AdminDashboardProps) {
    auth(["admin"]);
    const params = await searchParams;
    const selectedPeriod = params?.period || '7';

    const data = await getAnalyticsData(Number(selectedPeriod));

    const handlePeriodChange = async (period: string) => {
        'use server';
        auth(["admin"]);
        redirect(`?period=${period}`);
    };

    return (
        <AdminDashboardClient
            initialAnalyticsData={data.analytics}
            initialEntitiesData={data.entities}
            onPeriodChange={handlePeriodChange}
            initialPeriod={selectedPeriod}
        />
    );
}
