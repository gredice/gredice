import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { GardenRouteLoading } from '../../components/game/GardenRouteLoading';
import { OutletGardenWithAnalytics } from '../../components/game/OutletGardenWithAnalytics';

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

export default function OutletGardenPage() {
    return (
        <Suspense fallback={<GardenRouteLoading />}>
            <OutletGardenWithAnalytics />
        </Suspense>
    );
}
