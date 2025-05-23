'use client';

import { useEffect } from "react";
import { useGameState } from "../useGameState";
import { useControls } from 'leva';
import { Perf } from 'r3f-perf'
import { useWeatherNow } from "../hooks/useWeatherNow";

export function DebugHud() {
    const { stats } = useControls({
        stats: { value: false, label: "Show stats" },
    });

    const setWeather = useGameState(s => s.setWeather);
    const currentTime = useGameState(s => s.currentTime);
    const setFreezeTime = useGameState(s => s.setFreezeTime);

    const { data: weather } = useWeatherNow();
    const { timeOfDay } = useControls('Environment', {
        timeOfDay: { value: (currentTime.getHours() * 60 * 60 + currentTime.getMinutes() * 60 + currentTime.getSeconds()) / (24 * 60 * 60), min: 0, max: 1 },
    });
    const { overrideWeather } = useControls('Environment', {
        overrideWeather: { value: false },
    });
    const { cloudy, rainy, snowy, foggy } = useControls('Environment', {
        cloudy: { value: weather?.cloudy ?? 0, min: 0, max: 1, disabled: !overrideWeather },
        rainy: { value: weather?.rainy ?? 0, min: 0, max: 1, disabled: !overrideWeather },
        snowy: { value: weather?.snowy ?? 0, min: 0, max: 1, disabled: !overrideWeather },
        foggy: { value: weather?.foggy ?? 0, min: 0, max: 1, disabled: !overrideWeather },
    }, [overrideWeather]);

    useEffect(() => {
        if (overrideWeather) {
            setWeather({ cloudy, rainy, snowy, foggy });
        }
    }, [cloudy, rainy, snowy, foggy, overrideWeather]);

    useEffect(() => {
        const date = new Date();
        const seconds = timeOfDay * 24 * 60 * 60;
        date.setHours(seconds / 60 / 60);
        date.setMinutes((seconds / 60) % 60);
        date.setSeconds(seconds % 60);
        setFreezeTime(date);
    }, [timeOfDay]);

    return (
        <>
            {stats && <Perf />}
        </>
    );
}
