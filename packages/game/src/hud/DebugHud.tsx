'use client';

import { orderBy } from "@signalco/js";
import { useEffect } from "react";
import { Vector3 } from "three";
import { useGameState } from "../useGameState";
import { getStack } from "../utils/getStack";
import { button, useControls } from 'leva';
import { v4 as uuidv4 } from 'uuid';
import { Perf } from 'r3f-perf'
import { useWeatherNow } from "../hooks/useWeatherNow";

export function DebugHud() {
    const { stats, grid } = useControls({
        stats: { value: false, label: "Show stats" },
        grid: { value: false, label: "Show grid" },
    });

    const gameState = useGameState();
    const handlePlaceBlock = (name: string) => {
        let x = 0, z = 0;
        // Search for empty stack in watter flow pattern
        // place block in first empty stack
        while (true) {
            const stack = getStack({ x, z });
            if (!stack || stack.blocks.length === 0) {
                break;
            }
            x++;
            if (x > z + 1) {
                x = 0;
                z++;
            }
        }

        gameState.placeBlock(new Vector3(x, 0, z), { id: uuidv4(), name, rotation: 0 });
    };

    let entitiesButtons = {};
    for (const entity of orderBy(gameState.data.blocks, (a, b) => a.information.label.localeCompare(b.information.label))) {
        entitiesButtons = {
            ...entitiesButtons,
            [entity.information.label]: button(() => handlePlaceBlock(entity.information.name))
        }
    }
    useControls('Entities', entitiesButtons);

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
        gameState.setInitial(gameState.appBaseUrl, gameState.data, date);
    }, [timeOfDay]);

    return (
        <>
            {grid && <gridHelper args={[100, 100, '#B8B4A3', '#CFCBB7']} position={[0.5, 0, 0.5]} />}
            {stats && <Perf />}
        </>
    );
}
