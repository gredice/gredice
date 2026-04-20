import {
    getEntityTypesOrganizedByCategories,
    getPendingAchievementsCount,
    getSetting,
    SettingsKeys,
} from '@gredice/storage';
import { SignedOut } from '@signalco/auth-client/components';
import { AuthProtectedSection } from '@signalco/auth-server/components';
import { type PropsWithChildren, Suspense } from 'react';
import {
    AdminPageBreadcrumbs,
    LoginDialog,
    MobileHeader,
    Nav,
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
    const isAdmin = await auth(['admin']).then(
        () => true,
        () => false,
    );
    const [
        { categorizedTypes, uncategorizedTypes, shadowTypes },
        pendingAchievementsCount,
        dashboardQuickActionsSetting,
    ] = await Promise.all([
        getEntityTypesOrganizedByCategories(),
        isAdmin ? getPendingAchievementsCount() : Promise.resolve(0),
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
                <div className="grow bg-secondary">
                    <MobileHeader />
                    <main className="relative h-full md:h-full min-h-[calc(100vh-3.5rem)] md:min-h-screen">
                        <div className="flex flex-row min-h-full">
                            {/* Desktop Navigation */}
                            <div className="hidden md:block p-4 min-w-64">
                                <Nav />
                            </div>
                            {/* Main Content */}
                            <div className="min-h-full grow md:pt-2">
                                <div className="p-2 md:p-4 bg-background rounded-t-xl md:border-l md:border-t md:rounded-tr-none min-h-full">
                                    <AuthProtectedSection auth={authAdmin}>
                                        <Suspense>
                                            <div className="mb-3 hidden md:block">
                                                <AdminPageBreadcrumbs />
                                            </div>
                                            {children}
                                        </Suspense>
                                    </AuthProtectedSection>
                                </div>
                            </div>
                        </div>
                        <SignedOut>
                            <LoginDialog />
                        </SignedOut>
                    </main>
                </div>
            </AdminClientProvider>
        </AuthAppProvider>
    );
}
