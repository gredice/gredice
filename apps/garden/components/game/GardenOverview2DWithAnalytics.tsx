'use client';

import { GameAnalyticsProvider } from '@gredice/game/analytics';
import {
    GardenOverview2DDynamic,
    type GardenOverview2DProps,
} from '@gredice/game/garden-2d';
import { usePostHog } from '@posthog/next';

export function GardenOverview2DWithAnalytics(props: GardenOverview2DProps) {
    const posthog = usePostHog();

    return (
        <GameAnalyticsProvider
            capture={(eventName, properties) => {
                posthog?.capture(eventName, {
                    surface: 'garden_2d',
                    ...properties,
                });
            }}
        >
            <GardenOverview2DDynamic {...props} />
        </GameAnalyticsProvider>
    );
}
