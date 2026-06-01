'use client';

import { useEffect, useRef } from 'react';
import { groundGameAssetNames, primaryGameAssetNames } from './data/models';
import { GameFlagsContext } from './GameFlagsContext';
import { GameScene, type GameSceneProps } from './GameScene';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from './useGameState';
import { preloadGameAssetModels } from './utils/useGameGLTF';

export function GameSceneWrapper({
    appBaseUrl,
    spriteBaseUrl,
    flags,
    freezeTime,
    dayNightCycleDisabled,
    mockGarden,
    localSandboxStorageKey,
    winterMode,
    ...rest
}: GameSceneProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            spriteBaseUrl,
            dayNightCycleDisabled,
            freezeTime: freezeTime || null,
            isMock: mockGarden || false,
            localSandboxStorageKey,
            winterMode: winterMode ?? 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

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

    const resolvedAppBaseUrl = appBaseUrl ?? '';
    preloadGameAssetModels(resolvedAppBaseUrl, groundGameAssetNames);

    useEffect(() => {
        const preloadPrimaryAssets = () => {
            preloadGameAssetModels(resolvedAppBaseUrl, primaryGameAssetNames);
        };

        const timeout = window.setTimeout(preloadPrimaryAssets, 0);
        return () => window.clearTimeout(timeout);
    }, [resolvedAppBaseUrl]);

    return (
        <GameStateContext.Provider value={storeRef.current}>
            <GameFlagsContext.Provider value={flags ?? {}}>
                <GameScene flags={flags} {...rest} />
            </GameFlagsContext.Provider>
        </GameStateContext.Provider>
    );
}
