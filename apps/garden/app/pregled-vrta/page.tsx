import { SignedIn, SignedOut } from '@gredice/ui/auth';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import LoginModal from '../../components/auth/LoginModal';
import { GardenOverview2DWithAnalytics } from '../../components/game/GardenOverview2DWithAnalytics';
import { GardenRouteLoading } from '../../components/game/GardenRouteLoading';
import { getGardenGameFlags } from '../getGardenGameFlags';

const impersonationFlagCookieName = 'gredice_impersonating';

export const metadata: Metadata = {
    title: '2D pregled vrta | Gredice',
    description:
        'Brzi top-down pregled vrta bez 3D iscrtavanja, uz sve alate za upravljanje vrtom.',
};

export const viewport: Viewport = {
    initialScale: 1,
    maximumScale: 1,
    themeColor: '#2e6f40',
    userScalable: false,
    viewportFit: 'cover',
    width: 'device-width',
};

export default function GardenOverviewPage() {
    return (
        <Suspense fallback={<GardenRouteLoading />}>
            <GardenOverview />
        </Suspense>
    );
}

async function GardenOverview() {
    const cookieStore = await cookies();
    const suppressOpeningHud =
        cookieStore.get(impersonationFlagCookieName)?.value === '1';
    const flags = await getGardenGameFlags();

    return (
        <div className="relative grid h-[100dvh] grid-cols-1 overflow-hidden">
            <SignedIn>
                <GardenOverview2DWithAnalytics
                    flags={flags}
                    suppressOpeningHud={suppressOpeningHud}
                />
            </SignedIn>
            <SignedOut>
                <GardenOverview2DWithAnalytics
                    flags={flags}
                    mockGarden
                    hideHud
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
