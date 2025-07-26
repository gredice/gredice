'use client';

import { useRef } from 'react';
import { createGameState, GameStateContext, GameStateStore } from './useGameState';
import { useGLTF } from '@react-three/drei';
import { models } from './data/models';
import { GameScene, GameSceneProps } from './GameScene';

export function GameSceneWrapper({ appBaseUrl, freezeTime, mockGarden, ...rest }: GameSceneProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            freezeTime: freezeTime || null,
            isMock: mockGarden || false,
        });
    }

    useGLTF.preload((appBaseUrl ?? '') + models.GameAssets.url);

    return (
        <GameStateContext.Provider value={storeRef.current}>
            <GameScene {...rest} />
        </GameStateContext.Provider>
    );
}
