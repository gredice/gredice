'use client';

import { GameAnalyticsProvider } from '@gredice/game/analytics';
import { Spinner } from '@gredice/ui/Spinner';
import { usePostHog } from '@posthog/next';
import dynamic from 'next/dynamic';

const OutletGardenViewer = dynamic(
    () =>
        import('@gredice/game/outlet-garden').then(
            (module) => module.OutletGardenViewer,
        ),
    {
        loading: () => (
            <div className="grid h-[100dvh] place-items-center bg-[#cfeaca]">
                <Spinner
                    className="size-8 text-green-900"
                    loadingLabel="Teleportiranje u Outlet vrt"
                />
            </div>
        ),
        ssr: false,
    },
);

export function OutletGardenWithAnalytics() {
    const posthog = usePostHog();

    return (
        <GameAnalyticsProvider
            capture={(eventName, properties) => {
                posthog?.capture(eventName, {
                    surface: 'outlet_garden',
                    ...properties,
                });
            }}
        >
            <OutletGardenViewer />
        </GameAnalyticsProvider>
    );
}
