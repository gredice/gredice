'use client';

import { type PropsWithChildren, useEffect, useRef } from 'react';
import { type GameFeatureFlags, GameFlagsContext } from './GameFlagsContext';
import type { GameSceneProps } from './GameScene';
import { GardenSelectionGate } from './GardenSelectionGate';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from './useGameState';

export type GameRuntimeProviderProps = PropsWithChildren<
    Pick<
        GameSceneProps,
        | 'appBaseUrl'
        | 'authenticatedGardenQueriesEnabled'
        | 'dayNightCycleDisabled'
        | 'flags'
        | 'freezeTime'
        | 'initialQualitySetting'
        | 'localSandboxInitialStacks'
        | 'localSandboxStorageKey'
        | 'mockGarden'
        | 'mockGardenProfile'
        | 'spriteBaseUrl'
        | 'winterMode'
    > & {
        visualPlacementEffectsEnabled?: boolean;
    }
>;

export function GameRuntimeProvider({
    appBaseUrl,
    authenticatedGardenQueriesEnabled = true,
    children,
    dayNightCycleDisabled,
    flags,
    freezeTime,
    initialQualitySetting,
    localSandboxInitialStacks,
    localSandboxStorageKey,
    mockGarden,
    mockGardenProfile,
    spriteBaseUrl,
    visualPlacementEffectsEnabled,
    winterMode,
}: GameRuntimeProviderProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            authenticatedGardenQueriesEnabled,
            spriteBaseUrl,
            dayNightCycleDisabled,
            freezeTime: freezeTime || null,
            initialQualitySetting,
            isMock: mockGarden || false,
            localSandboxStorageKey,
            localSandboxInitialStacks,
            mockGardenProfile,
            visualPlacementEffectsEnabled,
            winterMode: winterMode ?? 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

    useEffect(() => {
        storeRef.current?.getState().setWinterMode(winterMode ?? 'summer');
    }, [winterMode]);

    useEffect(() => {
        storeRef.current
            ?.getState()
            .setMockGardenProfile(mockGardenProfile ?? 'default');
    }, [mockGardenProfile]);

    useEffect(() => {
        storeRef.current?.getState().setFreezeTime(freezeTime ?? null);
    }, [freezeTime]);

    useEffect(() => {
        if (initialQualitySetting) {
            storeRef.current?.setState({
                gameQualitySetting: initialQualitySetting,
            });
        }
    }, [initialQualitySetting]);

    return (
        <GameStateContext.Provider value={storeRef.current}>
            <GameFlagsContext.Provider
                value={(flags ?? {}) satisfies GameFeatureFlags}
            >
                <GardenSelectionGate
                    disabled={Boolean(mockGarden || localSandboxStorageKey)}
                >
                    {children}
                </GardenSelectionGate>
            </GameFlagsContext.Provider>
        </GameStateContext.Provider>
    );
}
