'use client';

import { StatsGl } from "@react-three/drei";
import { orderBy } from "@signalco/js";
import { useEffect, useState } from "react";
import { Vector3 } from "three";
import { makeButton, useTweaks } from "use-tweaks";
import { useGameState } from "../useGameState";
import { getStack } from "../utils/getStack";

export function DebugHud() {
    const stats = false;
    // const [stats, setStats] = useState(false);
    // const [grid, setGrid] = useState(false);
    // useTweaks('Debug', {
    //     ...makeButton('Show Stats', () => setStats(!stats)),
    //     ...makeButton('Show Grid', () => setGrid(!grid)),
    // });

    // const placeBlock = useGameState(state => state.placeBlock);
    // const handlePlaceBlock = (name: string) => {
    //     let x = 0, z = 0;
    //     // Search for empty stack in watter flow pattern
    //     // place block in first empty stack
    //     while (true) {
    //         const stack = getStack({ x, z });
    //         if (!stack || stack.blocks.length === 0) {
    //             break;
    //         }
    //         x++;
    //         if (x > z + 1) {
    //             x = 0;
    //             z++;
    //         }
    //     }

    //     placeBlock(new Vector3(x, 0, z), { name, rotation: 0 });
    // };

    // const gameState = useGameState();

    // let entitiesButtons = {};
    // for (const entity of orderBy(gameState.data.blocks, (a, b) => a.information.label.localeCompare(b.information.label))) {
    //     entitiesButtons = {
    //         ...entitiesButtons,
    //         ...makeButton(entity.information.label, () => handlePlaceBlock(entity.information.name))
    //     }
    // }
    // useTweaks('Entities', entitiesButtons);

    // const { timeOfDay } = useTweaks('Environment', {
    //     timeOfDay: { value: (gameState.currentTime.getHours() * 60 * 60 + gameState.currentTime.getMinutes() * 60 + gameState.currentTime.getSeconds()) / (24 * 60 * 60), min: 0, max: 1 },
    // });

    // useEffect(() => {
    //     const date = new Date();
    //     const seconds = timeOfDay * 24 * 60 * 60;
    //     date.setHours(seconds / 60 / 60);
    //     date.setMinutes((seconds / 60) % 60);
    //     date.setSeconds(seconds % 60);
    //     gameState.setInitial(gameState.appBaseUrl, gameState.data, date);
    // }, [timeOfDay]);

    return (
        <>
            {/* {grid && <gridHelper args={[100, 100, '#B8B4A3', '#CFCBB7']} position={[0.5, 0, 0.5]} />} */}
            {stats && <StatsGl className='absolute top-0 left-0' />}
        </>
    );
}
