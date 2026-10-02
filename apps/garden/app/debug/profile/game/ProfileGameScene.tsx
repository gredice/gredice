'use client';

import { GameScene, type GameSceneProps } from '@gredice/game';
import { useEffect, useMemo, useState } from 'react';
import { restoreGameProfileDate } from './profileDate';
import { resolveGameProfileControllerEnabled } from './profileFlags';
import {
    gameProfileGardenSwitchEventName,
    readGameProfileGardenSwitchProfile,
} from './profileGardenSwitch';
import {
    createGameProfileWeatherWitness,
    gameProfileWeatherTransitionEventName,
    readGameProfileWeatherTransitionRequest,
    resolveGameProfileWeatherTransition,
} from './profileWeather';

type ProfileGameSceneProps = Omit<GameSceneProps, 'freezeTime'> & {
    freezeTime?: string;
    gardenSwitchEnabled?: boolean;
    cacheClearanceWitnessMode?: string;
};

export function ProfileGameScene({
    gardenSwitchEnabled = false,
    cacheClearanceWitnessMode,
    freezeTime,
    mockGardenProfile: initialMockGardenProfile,
    weather: initialWeather,
    ...gameSceneProps
}: ProfileGameSceneProps) {
    const date = useMemo(
        () => restoreGameProfileDate(freezeTime),
        [freezeTime],
    );
    const [mockGardenProfile, setMockGardenProfile] = useState(
        initialMockGardenProfile,
    );
    const [weather, setWeather] = useState(initialWeather);
    const [weatherReceipt, setWeatherReceipt] = useState({
        request: 'initial',
        revision: 0,
    });

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
            if (cacheClearanceWitnessMode) {
                setWeatherReceipt((previous) => ({
                    request,
                    revision: previous.revision + 1,
                }));
            }
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
    }, [cacheClearanceWitnessMode]);

    const scene = (
        <GameScene
            {...gameSceneProps}
            enableGameProfileController={resolveGameProfileControllerEnabled(
                gameSceneProps.enableGameProfileController,
                cacheClearanceWitnessMode,
            )}
            freezeTime={date}
            mockGardenProfile={mockGardenProfile}
            weather={weather}
        />
    );
    return cacheClearanceWitnessMode ? (
        <>
            <output
                hidden
                data-game-profile-cache-weather-witness={JSON.stringify({
                    mode: cacheClearanceWitnessMode,
                    cacheEnabled:
                        gameSceneProps.staticOpaqueSceneCache === true,
                    ...weatherReceipt,
                    weather: createGameProfileWeatherWitness(weather),
                })}
            />
            {scene}
        </>
    ) : (
        scene
    );
}
