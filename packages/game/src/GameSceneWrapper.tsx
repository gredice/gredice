'use client';

import { useEffect } from 'react';
import { groundGameAssetNames, primaryGameAssetNames } from './data/models';
import { resetPlacementAnimationProfileMetrics } from './entities/placementAnimationProfileMetrics';
import { GameRuntimeProvider } from './GameRuntimeProvider';
import { GameScene, type GameSceneProps } from './GameScene';
import { GameProfileController } from './scene/GameProfileController';
import { preloadGameAssetModels } from './utils/useGameGLTF';

export function GameSceneWrapper({
    appBaseUrl,
    authenticatedGardenQueriesEnabled,
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
        <GameRuntimeProvider
            appBaseUrl={appBaseUrl}
            authenticatedGardenQueriesEnabled={
                authenticatedGardenQueriesEnabled
            }
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
            {enableGameProfileController ? <GameProfileController /> : null}
        </GameRuntimeProvider>
    );
}
