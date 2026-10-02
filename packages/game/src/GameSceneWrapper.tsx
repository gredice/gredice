'use client';

import { useEffect } from 'react';
import { resetPlacementAnimationProfileMetrics } from './entities/placementAnimationProfileMetrics';
import { GameRuntimeProvider } from './GameRuntimeProvider';
import { GameScene, type GameSceneProps } from './GameScene';

export function GameSceneWrapper({
    appBaseUrl,
    authenticatedGardenQueriesEnabled,
    gardenPacksEnabled,
    spriteBaseUrl,
    flags,
    freezeTime,
    dayNightCycleDisabled,
    initialQualitySetting,
    enableGameProfileController,
    mockGarden,
    mockGardenProfile,
    localSandboxStorageKey,
    localSandboxInitialStacks,
    winterMode,
    ...rest
}: GameSceneProps) {
    useEffect(() => {
        resetPlacementAnimationProfileMetrics();
    }, []);

    // Asset loading follows the garden's scene manifest (see
    // GardenSceneResourceController); no bucket is preloaded up front.

    return (
        <GameRuntimeProvider
            appBaseUrl={appBaseUrl}
            authenticatedGardenQueriesEnabled={
                authenticatedGardenQueriesEnabled
            }
            gardenPacksEnabled={gardenPacksEnabled}
            dayNightCycleDisabled={dayNightCycleDisabled}
            flags={flags}
            freezeTime={freezeTime}
            initialQualitySetting={initialQualitySetting}
            localSandboxInitialStacks={localSandboxInitialStacks}
            localSandboxStorageKey={localSandboxStorageKey}
            mockGarden={mockGarden}
            mockGardenProfile={mockGardenProfile}
            spriteBaseUrl={spriteBaseUrl}
            winterMode={winterMode}
        >
            <GameScene
                enableGameProfileController={enableGameProfileController}
                flags={flags}
                {...rest}
            />
        </GameRuntimeProvider>
    );
}
