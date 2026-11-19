import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
    PathnameContext,
    SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { AdminDashboardClient } from '../components/admin/dashboard/AdminDashboardClient';
import { AdminDashboardHeaderFrame } from './AdminDashboardHeaderFrame';

export function AdminDashboardHarness({
    days = 30,
    custom = false,
}: {
    days?: number;
    custom?: boolean;
}) {
    const dates = Array.from({ length: days }, (_, index) =>
        new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10),
    );
    return (
        <AppRouterContext.Provider
            value={{
                bfcacheId: 'dashboard-date-range',
                back() {},
                forward() {},
                refresh() {},
                push() {},
                replace(url) {
                    window.history.replaceState(null, '', url);
                },
                prefetch: async () => {},
            }}
        >
            <PathnameContext.Provider value="/admin">
                <SearchParamsContext.Provider value={new URLSearchParams()}>
                    <AdminDashboardHeaderFrame>
                        <AdminDashboardClient
                            initialAnalyticsData={{
                                users: 0,
                                usersBefore: 0,
                                accounts: 0,
                                accountsBefore: 0,
                                farms: 0,
                                farmsBefore: 0,
                                gardens: 0,
                                gardensBefore: 0,
                                blocks: 0,
                                blocksBefore: 0,
                                events: 0,
                                eventsBefore: 0,
                                raisedBeds: 0,
                                raisedBedsBefore: 0,
                                transactions: 0,
                                transactionsBefore: 0,
                                deliveryRequests: 0,
                                deliveryRequestsBefore: 0,
                                activeUsers: {
                                    daily: 0,
                                    weekly: 0,
                                    monthly: 0,
                                },
                            }}
                            initialEntitiesData={[]}
                            initialQuickActions={[]}
                            initialQuickActionBadgeCounts={{
                                pendingCmsPagesReviewCount: 0,
                                pendingAchievementsCount: 0,
                                pendingApprovalTasksCount: 0,
                            }}
                            initialPeriod={custom ? 'custom' : String(days)}
                            initialFrom={custom ? dates[0] : undefined}
                            initialTo={custom ? dates.at(-1) : undefined}
                            initialRegistrations={dates.map((date) => ({
                                date,
                                count: 1,
                            }))}
                            initialOperationsDurationData={{
                                totalMinutes: days * 6,
                                operationsMinutes: days,
                                sowingMinutes: days * 2,
                                plannedMinutes: days * 3,
                                byUser: [],
                                daily: dates.map((date) => ({
                                    date,
                                    operationsMinutes: 1,
                                    sowingMinutes: 2,
                                    plannedMinutes: 3,
                                    totalMinutes: 6,
                                    byUser: [],
                                })),
                            }}
                            initialSunflowersData={dates.map((date) => ({
                                date,
                                earned: 5,
                                spent: 2,
                            }))}
                            initialAiData={{
                                count: 0,
                                totalTokens: 0,
                                totalCostEur: 0,
                            }}
                        />
                    </AdminDashboardHeaderFrame>
                </SearchParamsContext.Provider>
            </PathnameContext.Provider>
        </AppRouterContext.Provider>
    );
}
