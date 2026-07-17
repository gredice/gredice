import { getUser } from '@gredice/storage';
import { IconButton } from '@gredice/ui/IconButton';
import { Settings } from '@gredice/ui/icons';
import { Suspense } from 'react';
import LoginDialog from '../components/auth/LoginDialog';
import { LogoutButton } from '../components/auth/LogoutButton';
import { auth } from '../lib/auth/auth';
import { FarmDashboardGreeting } from './FarmDashboardGreeting';
import { FarmTodayLoadingState } from './FarmTodayLoadingState';
import { FarmTodayView } from './FarmTodayView';
import { getFarmTodayData } from './farmTodayData';

export const dynamic = 'force-dynamic';

async function getFarmAuth() {
    try {
        return await auth(['farmer', 'admin']);
    } catch {
        return null;
    }
}

async function FarmTodayDashboard({
    accountId,
    fallbackDisplayName,
    sessionIncarnation,
    userId,
}: {
    accountId: string;
    fallbackDisplayName: string;
    sessionIncarnation: string;
    userId: string;
}) {
    const [data, dbUser] = await Promise.all([
        getFarmTodayData(userId),
        getUser(userId).catch((cause) => {
            console.error('[Farm Today] user profile unavailable', cause);
            return null;
        }),
    ]);
    const displayName =
        dbUser?.displayName ?? dbUser?.userName ?? fallbackDisplayName;

    return (
        <FarmTodayView
            data={data}
            heading={
                <FarmDashboardGreeting
                    displayName={displayName}
                    initialDateIso={new Date().toISOString()}
                />
            }
            taskActionContext={{ accountId, sessionIncarnation, userId }}
            headerActions={
                <>
                    <IconButton
                        data-farm-analytics="navigation"
                        data-farm-navigation-destination="settings"
                        data-farm-navigation-source="today_tools"
                        href="/settings"
                        size="lg"
                        title="Postavke"
                        variant="plain"
                    >
                        <Settings aria-hidden className="size-4 shrink-0" />
                    </IconButton>
                    <LogoutButton
                        sessionIncarnation={sessionIncarnation}
                        size="lg"
                        userId={userId}
                    />
                </>
            }
        />
    );
}

export default async function Home() {
    const authContext = await getFarmAuth();

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            {authContext ? (
                <Suspense fallback={<FarmTodayLoadingState />}>
                    <FarmTodayDashboard
                        accountId={authContext.accountId}
                        fallbackDisplayName={authContext.user.userName}
                        sessionIncarnation={authContext.sessionIncarnation}
                        userId={authContext.userId}
                    />
                </Suspense>
            ) : (
                <LoginDialog />
            )}
        </div>
    );
}
