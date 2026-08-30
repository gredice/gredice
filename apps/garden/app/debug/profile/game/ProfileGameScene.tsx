'use client';

import { GameScene, type GameSceneProps } from '@gredice/game';
import { useEffect, useState } from 'react';
import {
    gameProfileGardenSwitchEventName,
    readGameProfileGardenSwitchProfile,
} from './profileGardenSwitch';
import {
    gameProfileWeatherTransitionEventName,
    readGameProfileWeatherTransitionRequest,
    resolveGameProfileWeatherTransition,
} from './profileWeather';

type ProfileGameSceneProps = GameSceneProps & {
    gardenSwitchEnabled?: boolean;
};

export function ProfileGameScene({
    gardenSwitchEnabled = false,
    mockGardenProfile: initialMockGardenProfile,
    weather: initialWeather,
    ...gameSceneProps
}: ProfileGameSceneProps) {
    const [mockGardenProfile, setMockGardenProfile] = useState(
        initialMockGardenProfile,
    );
    const [weather, setWeather] = useState(initialWeather);

    useEffect(() => {
        if (!gardenSwitchEnabled) {
            return;
        }

        const handleGardenSwitch = (event: Event) => {
            const profile =
                event instanceof CustomEvent
                    ? readGameProfileGardenSwitchProfile(event.detail)
                    : undefined;
            if (profile) {
                setMockGardenProfile(profile);
            }
        };

        window.addEventListener(
            gameProfileGardenSwitchEventName,
            handleGardenSwitch,
        );
        return () =>
            window.removeEventListener(
                gameProfileGardenSwitchEventName,
                handleGardenSwitch,
            );
    }, [gardenSwitchEnabled]);

    useEffect(() => {
        const handleWeatherTransition = (event: Event) => {
            const request =
                event instanceof CustomEvent
                    ? readGameProfileWeatherTransitionRequest(event.detail)
                    : undefined;
            if (!request) {
                return;
            }

            setWeather(resolveGameProfileWeatherTransition(request));
        };

        window.addEventListener(
            gameProfileWeatherTransitionEventName,
            handleWeatherTransition,
        );
        return () =>
            window.removeEventListener(
                gameProfileWeatherTransitionEventName,
                handleWeatherTransition,
            );
    }, []);

    return (
        <GameScene
            {...gameSceneProps}
            mockGardenProfile={mockGardenProfile}
            weather={weather}
        />
    );
}
