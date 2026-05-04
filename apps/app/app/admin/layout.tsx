import {
    getEntityTypesOrganizedByCategories,
    getPendingAchievementsCount,
    getSetting,
    SettingsKeys,
} from '@gredice/storage';
import { SignedOut } from '@signalco/auth-client/components';
import { AuthProtectedSection } from '@signalco/auth-server/components';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type PropsWithChildren, Suspense } from 'react';
import {
    AdminPageCardHeader,
    DesktopNav,
    DesktopNavProvider,
    LoginDialog,
} from '../../components/admin/navigation';
import { AdminClientProvider } from '../../components/admin/providers';
import { AuthAppProvider } from '../../components/providers/AuthAppProvider';
import { auth } from '../../lib/auth/auth';
import { impersonationRefreshCookieName } from '../../lib/auth/sessionConfig';
import {
    buildDashboardQuickActionOptions,
    getDashboardQuickActionsFromConfig,
    getDefaultDashboardQuickActions,
} from '../../src/dashboardQuickActions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: PropsWithChildren) {
    const requestHeaders = await headers();
    const requestHost = requestHeaders.get('host') ?? '';
    const landingUrl = requestHost.includes('.test')
        ? 'https://www.gredice.test'
        : 'https://www.gredice.com';

    const authAdmin = auth.bind(null, ['admin']);
    const isAdmin = await auth(['admin']).then(
        () => true,
        () => false,
    );
    const isImpersonating =
        (await cookies()).get(impersonationRefreshCookieName) !== undefined;

    if (!isAdmin && !isImpersonating) {
        redirect(landingUrl);
    }
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
                <div className="grow bg-secondary/40">
                    <main className="relative h-full min-h-screen">
                        <DesktopNavProvider>
                            <div className="flex min-h-full flex-row gap-3 md:gap-4 md:p-4">
                                {/* Desktop Navigation */}
                                <DesktopNav />
                                {/* Main Content */}
                                <div className="min-h-full grow">
                                    <div className="min-h-full border bg-background p-3 md:rounded-2xl md:p-4">
                                        <AuthProtectedSection auth={authAdmin}>
                                            <Suspense>
                                                <AdminPageCardHeader />
                                                {children}
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
