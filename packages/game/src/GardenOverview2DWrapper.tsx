'use client';

import { GameRuntimeProvider } from './GameRuntimeProvider';
import type { GameSceneProps } from './GameScene';
import { GardenOverview2DContent } from './GardenOverview2DContent';

export type GardenOverview2DProps = Pick<
    GameSceneProps,
    | 'appBaseUrl'
    | 'className'
    | 'dayNightCycleDisabled'
    | 'debugHud'
    | 'flags'
    | 'freezeTime'
    | 'hideHud'
    | 'initialQualitySetting'
    | 'localSandboxInitialStacks'
    | 'localSandboxStorageKey'
    | 'mockGarden'
    | 'mockGardenProfile'
    | 'noWeather'
    | 'spriteBaseUrl'
    | 'suppressOpeningHud'
    | 'winterMode'
>;

export function GardenOverview2DWrapper({
    appBaseUrl,
    dayNightCycleDisabled,
    flags,
    freezeTime,
    initialQualitySetting,
    localSandboxInitialStacks,
    localSandboxStorageKey,
    mockGarden,
    mockGardenProfile,
    spriteBaseUrl,
    winterMode,
    ...contentProps
}: GardenOverview2DProps) {
    return (
        <GameRuntimeProvider
            appBaseUrl={appBaseUrl}
            dayNightCycleDisabled={dayNightCycleDisabled}
            flags={flags}
            freezeTime={freezeTime}
            initialQualitySetting={initialQualitySetting}
            localSandboxInitialStacks={localSandboxInitialStacks}
            localSandboxStorageKey={localSandboxStorageKey}
            mockGarden={mockGarden}
            mockGardenProfile={mockGardenProfile}
            spriteBaseUrl={spriteBaseUrl}
            visualPlacementEffectsEnabled={false}
            winterMode={winterMode}
        >
            <GardenOverview2DContent {...contentProps} />
        </GameRuntimeProvider>
    );
}
