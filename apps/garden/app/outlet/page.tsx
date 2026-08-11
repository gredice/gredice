import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { GardenRouteLoading } from '../../components/game/GardenRouteLoading';
import { OutletGardenWithAnalytics } from '../../components/game/OutletGardenWithAnalytics';
import { enableOutletGardenFlag } from '../flags';

export const metadata: Metadata = {
    title: 'Outlet vrt | Gredice',
    description: 'Razgledaj dostupne outlet sadnice u interaktivnom 3D vrtu.',
    robots: { follow: false, index: false },
};

export const viewport: Viewport = {
    initialScale: 1,
    maximumScale: 1,
    themeColor: '#2e6f40',
    userScalable: false,
    viewportFit: 'cover',
    width: 'device-width',
};

async function OutletGardenGate({
    searchParams,
}: {
    searchParams: Promise<{ ponuda?: string | string[] }>;
}) {
    const [enabled, params] = await Promise.all([
        enableOutletGardenFlag(),
        searchParams,
    ]);
    if (!enabled) {
        const selectedOfferId = Array.isArray(params.ponuda)
            ? params.ponuda[0]
            : params.ponuda;
        const outletParam =
            selectedOfferId && /^[1-9]\d*$/u.test(selectedOfferId)
                ? selectedOfferId
                : '1';
        redirect(`/?outlet=${outletParam}`);
    }

    return <OutletGardenWithAnalytics />;
}

export default function OutletGardenPage({
    searchParams,
}: {
    searchParams: Promise<{ ponuda?: string | string[] }>;
}) {
    return (
        <Suspense fallback={<GardenRouteLoading />}>
            <OutletGardenGate searchParams={searchParams} />
        </Suspense>
    );
}
