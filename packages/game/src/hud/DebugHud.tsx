'use client';

import { useEffect } from "react";
import { useGameState } from "../useGameState";
import { useControls } from 'leva';
import { Perf } from 'r3f-perf'
import { useWeatherNow } from "../hooks/useWeatherNow";

export function DebugHud() {
    const { stats, grid } = useControls({
        stats: { value: false, label: "Show stats" },
        grid: { value: false, label: "Show grid" },
    });

    const gameState = useGameState();

    const { data: weather } = useWeatherNow();
    const { timeOfDay, cloudy, rainy, snowy, foggy, overrideWeather } = useControls('Environment', {
        timeOfDay: { value: (gameState.currentTime.getHours() * 60 * 60 + gameState.currentTime.getMinutes() * 60 + gameState.currentTime.getSeconds()) / (24 * 60 * 60), min: 0, max: 1 },
        overrideWeather: { value: false },
        cloudy: { value: weather?.cloudy ?? 0, min: 0, max: 1 },
        rainy: { value: weather?.rainy ?? 0, min: 0, max: 1 },
        snowy: { value: weather?.snowy ?? 0, min: 0, max: 1 },
        foggy: { value: weather?.foggy ?? 0, min: 0, max: 1 },
    });

    useEffect(() => {
        if (overrideWeather) {
            gameState.setWeather({ cloudy, rainy, snowy, foggy });
        }
    }, [cloudy, rainy, snowy, foggy, overrideWeather]);

    useEffect(() => {
        const date = new Date();
        const seconds = timeOfDay * 24 * 60 * 60;
        date.setHours(seconds / 60 / 60);
        date.setMinutes((seconds / 60) % 60);
        date.setSeconds(seconds % 60);
        gameState.setInitial(gameState.appBaseUrl, date);
    }, [timeOfDay]);

    return (
        <>
            {grid && <gridHelper args={[100, 100, '#B8B4A3', '#CFCBB7']} position={[0.5, 0, 0.5]} />}
            {stats && <Perf />}
        </>
    );
}
