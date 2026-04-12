'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { models } from './data/models';
import { GameFlagsContext } from './GameFlagsContext';
import { GameScene, type GameSceneProps } from './GameScene';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
} from './useGameState';

export function GameSceneWrapper({
    appBaseUrl,
    spriteBaseUrl,
    flags,
    freezeTime,
    mockGarden,
    winterMode,
    ...rest
}: GameSceneProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            spriteBaseUrl,
            freezeTime: freezeTime || null,
            isMock: mockGarden || false,
            winterMode: winterMode ?? 'summer',
        });
    }

    // Sync winterMode prop changes to the store
    useEffect(() => {
        if (storeRef.current) {
            storeRef.current.getState().setWinterMode(winterMode ?? 'summer');
        }
    }, [winterMode]);

    // Sync freezeTime prop changes to the store
    useEffect(() => {
        if (storeRef.current) {
            storeRef.current.getState().setFreezeTime(freezeTime ?? null);
        }
    }, [freezeTime]);

    useGLTF.preload((appBaseUrl ?? '') + models.GameAssets.url);

    return (
        <GameStateContext.Provider value={storeRef.current}>
            <GameFlagsContext.Provider value={flags ?? {}}>
                <GameScene flags={flags} {...rest} />
            </GameFlagsContext.Provider>
        </GameStateContext.Provider>
    );
}
