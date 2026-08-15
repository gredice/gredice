import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { GardenRouteLoading } from '../../components/game/GardenRouteLoading';
import { OutletGardenWithAnalytics } from '../../components/game/OutletGardenWithAnalytics';
import {
    enableOutletGardenCommerceFlag,
    enableOutletGardenFlag,
} from '../flags';

export const metadata: Metadata = {
    title: 'Dostupne sadnice | Gredice',
    description: 'Pregledaj dostupne outlet sadnice i detalje ponude.',
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

async function OutletGardenGate() {
    const [enabled, commerceEnabled] = await Promise.all([
        enableOutletGardenFlag(),
        enableOutletGardenCommerceFlag(),
    ]);
    if (!enabled) {
        redirect('/');
    }

    return <OutletGardenWithAnalytics commerceEnabled={commerceEnabled} />;
}

export default function OutletGardenPage() {
    return (
        <Suspense fallback={<GardenRouteLoading />}>
            <OutletGardenGate />
        </Suspense>
    );
}
