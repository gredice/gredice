import {
    getEntityTypesOrganizedByCategories,
    getPendingAchievementsCount,
    getSetting,
    SettingsKeys,
} from '@gredice/storage';
import { SignedOut } from '@gredice/ui/auth';
import { AuthProtectedSection } from '@gredice/ui/auth/server';
import { type PropsWithChildren, Suspense } from 'react';
import {
    AdminPageCardHeader,
    AdminPageHeaderProvider,
    DesktopNav,
    DesktopNavProvider,
    LoginDialog,
} from '../../components/admin/navigation';
import { AdminClientProvider } from '../../components/admin/providers';
import { AuthAppProvider } from '../../components/providers/AuthAppProvider';
import { auth } from '../../lib/auth/auth';
import {
    buildDashboardQuickActionOptions,
    getDashboardQuickActionsFromConfig,
    getDefaultDashboardQuickActions,
} from '../../src/dashboardQuickActions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: PropsWithChildren) {
    const authAdmin = auth.bind(null, ['admin']);
    const isAdmin = await authAdmin().then(
        () => true,
        () => false,
    );

    if (!isAdmin) {
        return (
            <AuthAppProvider>
                <div className="grow bg-secondary/40">
                    <main className="relative h-full min-h-screen">
                        <LoginDialog />
                    </main>
                </div>
            </AuthAppProvider>
        );
    }

    const [
        { categorizedTypes, uncategorizedTypes, shadowTypes },
        pendingAchievementsCount,
        dashboardQuickActionsSetting,
    ] = await Promise.all([
        getEntityTypesOrganizedByCategories(),
        getPendingAchievementsCount(),
        getSetting(SettingsKeys.DashboardQuickActions),
    ]);

    const quickActionEntityTypes = [
        ...categorizedTypes.flatMap((category) => category.entityTypes),
        ...uncategorizedTypes,
        ...shadowTypes,
    ];
    const quickActionOptions = buildDashboardQuickActionOptions(
        quickActionEntityTypes.map((entityType) => ({
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
        <AuthAppProvider>
            <AdminClientProvider
                categorizedTypes={categorizedTypes}
                uncategorizedTypes={uncategorizedTypes}
                shadowTypes={shadowTypes}
                pendingAchievementsCount={pendingAchievementsCount}
                quickActions={quickActions}
            >
                <div className="grow bg-secondary/40" data-gredice-admin-shell>
                    <main className="relative h-full min-h-screen">
                        <DesktopNavProvider>
                            <div
                                className="flex min-h-full flex-row gap-3 md:gap-4 md:p-4"
                                data-gredice-admin-frame
                            >
                                {/* Desktop Navigation */}
                                <DesktopNav />
                                {/* Main Content */}
                                <div
                                    className="min-h-full grow"
                                    data-gredice-admin-content
                                >
                                    <div
                                        className="min-h-full border bg-[var(--admin-page-content-background)] p-3 md:rounded-2xl md:p-4"
                                        data-gredice-admin-content-panel
                                    >
                                        <AuthProtectedSection auth={authAdmin}>
                                            <Suspense>
                                                <AdminPageHeaderProvider>
                                                    <AdminPageCardHeader />
                                                    {children}
                                                </AdminPageHeaderProvider>
                                            </Suspense>
                                        </AuthProtectedSection>
                                    </div>
                                </div>
                            </div>
                        </DesktopNavProvider>
                        <SignedOut>
                            <LoginDialog />
                        </SignedOut>
                    </main>
                </div>
            </AdminClientProvider>
        </AuthAppProvider>
    );
}
