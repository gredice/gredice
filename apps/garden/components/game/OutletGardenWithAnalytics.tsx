'use client';

import { GameAnalyticsProvider } from '@gredice/game/analytics';
import { usePostHog } from '@posthog/next';
import { OutletGardenRenderer } from './OutletGardenRenderer';

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
            <OutletGardenRenderer />
        </GameAnalyticsProvider>
    );
}
