'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { models } from './data/models';
import { GameScene, type GameSceneProps } from './GameScene';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
} from './useGameState';

export function GameSceneWrapper({
    appBaseUrl,
    freezeTime,
    mockGarden,
    isWinterMode,
    isHolidayMode,
    ...rest
}: GameSceneProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            freezeTime: freezeTime || null,
            isMock: mockGarden || false,
            isWinterMode: isWinterMode || false,
            isHolidayMode: isHolidayMode || false,
        });
    }

    // Sync isWinterMode prop changes to the store
    useEffect(() => {
        if (storeRef.current) {
            storeRef.current.getState().setIsWinterMode(isWinterMode || false);
            storeRef.current
                .getState()
                .setIsHolidayMode(isHolidayMode || false);
        }
    }, [isHolidayMode, isWinterMode]);

    useGLTF.preload((appBaseUrl ?? '') + models.GameAssets.url);

    return (
        <GameStateContext.Provider value={storeRef.current}>
            <GameScene {...rest} />
        </GameStateContext.Provider>
    );
}
