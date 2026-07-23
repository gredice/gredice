'use client';

import { GameScene, type GameSceneProps } from '@gredice/game';
import { useEffect, useState } from 'react';
import {
    gameProfileWeatherTransitionEventName,
    readGameProfileWeatherTransitionRequest,
    resolveGameProfileWeatherTransition,
} from './profileWeather';

export function ProfileGameScene({
    weather: initialWeather,
    ...gameSceneProps
}: GameSceneProps) {
    const [weather, setWeather] = useState(initialWeather);

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

    return <GameScene {...gameSceneProps} weather={weather} />;
}
