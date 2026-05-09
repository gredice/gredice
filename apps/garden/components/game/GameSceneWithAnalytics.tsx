'use client';

import {
    GameAnalyticsProvider,
    GameScene,
    type GameSceneProps,
} from '@gredice/game';
import { usePostHog } from '@posthog/next';

export function GameSceneWithAnalytics(props: GameSceneProps) {
    const posthog = usePostHog();

    return (
        <GameAnalyticsProvider
            capture={(eventName, properties) => {
                posthog?.capture(eventName, {
                    surface: 'garden_game',
                    ...properties,
                });
            }}
        >
            <GameScene {...props} />
        </GameAnalyticsProvider>
    );
}
