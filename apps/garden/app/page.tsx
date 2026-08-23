import { SignedIn, SignedOut } from '@gredice/ui/auth';
import type { Viewport } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import LoginModal from '../components/auth/LoginModal';
import { GameSceneWithAnalytics } from '../components/game/GameSceneWithAnalytics';
import { GardenRouteLoading } from '../components/game/GardenRouteLoading';
import { getGardenGameFlags } from './getGardenGameFlags';

const impersonationFlagCookieName = 'gredice_impersonating';

// Garden experience routes paint edge to edge. Other Garden routes keep the
// root viewport behavior so their document UI remains safely contained.
export const viewport: Viewport = {
    initialScale: 1,
    maximumScale: 1,
    themeColor: '#2e6f40',
    userScalable: false,
    viewportFit: 'cover',
    width: 'device-width',
};

export default function Home() {
    return (
        <Suspense fallback={<GardenRouteLoading />}>
            <GardenHome />
        </Suspense>
    );
}

async function GardenHome() {
    const cookieStore = await cookies();
    const suppressOpeningHud =
        cookieStore.get(impersonationFlagCookieName)?.value === '1';
    const flags = await getGardenGameFlags();

    return (
        <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
            <SignedIn>
                <GameSceneWithAnalytics
                    flags={flags}
                    deferDetails
                    suppressOpeningHud={suppressOpeningHud}
                />
            </SignedIn>
            <SignedOut>
                <GameSceneWithAnalytics
                    flags={flags}
                    mockGarden
                    hideHud
                    deferDetails
                />
            </SignedOut>
            <SignedOut>
                <div className="relative h-full">
                    <LoginModal />
                </div>
            </SignedOut>
        </div>
    );
}
