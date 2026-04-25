'use client';

import { cx } from '@signalco/ui-primitives/cx';
import { type HTMLAttributes, useEffect } from 'react';
import { Controls } from './controls/Controls';
import { EntityFactory } from './entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from './entities/EntityInstances';
import { RaisedBedMulchOverlays } from './entities/raisedBed/RaisedBedMulchOverlays';
import type { GameFeatureFlags } from './GameFlagsContext';
import { GameHud } from './GameHud';
<<<<<<< ours
import { useGameLoading } from './GameLoadingContext';
||||||| ancestor
=======
import { GameSceneDetailContext } from './GameSceneDetailContext';
>>>>>>> theirs
import {
    defaultGameCameraPosition,
    defaultGameCameraZoom,
    farGameCameraZoom,
} from './gameCamera';
import { useBlockData } from './hooks/useBlockData';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useDeferredSceneDetails } from './hooks/useDeferredSceneDetails';
import { useFocusPlacedBlock } from './hooks/useFocusPlacedBlock';
import { useGameTimeManager } from './hooks/useGameTimeManager';
import { useWeatherNow } from './hooks/useWeatherNow';
import { EditModeGrid } from './indicators/EditModeGrid';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import { ParticleSystemProvider } from './particles/ParticleSystem';
import { Environment } from './scene/Environment';
import { Scene } from './scene/Scene';
import { type GameState, useGameState, type WinterMode } from './useGameState';
import { useRaisedBedCloseup } from './useRaisedBedCloseup';

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string;
    spriteBaseUrl?: string;
    zoom?: 'far' | 'normal';

    // Demo purposes only
    freezeTime?: Date;
    noBackground?: boolean;
    noControls?: boolean;
    hideHud?: boolean;
    noWeather?: boolean;
    noSound?: boolean;
    mockGarden?: boolean;
    winterMode?: WinterMode;
    weather?: Partial<GameState['weather']>;
    deferDetails?: boolean;

    // Development purposes
    flags?: GameFeatureFlags;
};

export function GameScene({
    zoom = 'normal',
    noControls,
    noWeather,
    noBackground,
    noSound,
    hideHud,
    className,
    flags,
    weather,
    deferDetails,
    ...rest
}: GameSceneProps) {
    useGameTimeManager();
    useFocusPlacedBlock();
    useRaisedBedCloseup();
    const weatherVisualizationDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const weatherDisabled = noWeather || weatherVisualizationDisabled;
    const renderDetails = useDeferredSceneDetails(deferDetails);

    // Start non-critical metadata early, but don't block the first scene frame.
    useBlockData();
    const { data: garden, isLoading: gardenLoading } = useCurrentGarden();
<<<<<<< ours
    const { isLoading: weatherLoading } = useWeatherNow(!weatherDisabled);
    const isLoading = gardenLoading || blockDataLoading || weatherLoading;

    const loadingContext = useGameLoading();
    useEffect(() => {
        loadingContext?.setIsReady(!isLoading);
        return () => {
            loadingContext?.setIsReady(false);
        };
    }, [isLoading, loadingContext]);

||||||| ancestor
    const { isLoading: weatherLoading } = useWeatherNow(!weatherDisabled);
    const isLoading = gardenLoading || blockDataLoading || weatherLoading;
=======
    useWeatherNow(!weatherDisabled && !weather);
    const isLoading = gardenLoading;
>>>>>>> theirs
    if (isLoading) {
        return loadingContext ? null : <GardenLoadingIndicator />;
    }

    return (
        <div
            className={cx('animate-in duration-1000 fade-in', className)}
            {...rest}
        >
            <GameSceneDetailContext.Provider value={{ renderDetails }}>
                <Scene
                    position={defaultGameCameraPosition}
                    zoom={
                        zoom === 'far'
                            ? farGameCameraZoom
                            : defaultGameCameraZoom
                    }
                    className="!absolute"
                >
                    <ParticleSystemProvider>
                        <EditModeGrid />
                        <Environment
                            noBackground={noBackground}
                            noWeather={weatherDisabled}
                            noSound={noSound}
                            weather={weather}
                        />
                        <group>
                            {garden?.stacks.map((stack) =>
                                stack.blocks?.map((block, i) => (
                                    <EntityFactory
                                        // biome-ignore lint/suspicious/noArrayIndexKey: Using array index as key is acceptable here because block IDs are unique within a stack, and the order of blocks within a stack is unlikely to change. Using block.id alone is not sufficient as it may not be unique across different stacks.
                                        key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.id}-${block.name}-${i}`}
                                        name={block.name}
                                        stack={stack}
                                        block={block}
                                        rotation={block.rotation}
                                        variant={block.variant}
                                        noRenderInView={instancedBlockNames}
                                        noControl={noControls}
                                    />
                                )),
                            )}
                            {renderDetails && <RaisedBedMulchOverlays />}
                            <EntityInstances
                                stacks={garden?.stacks}
                                renderDetails={renderDetails}
                            />
                        </group>
                        {!noControls && <Controls />}
                    </ParticleSystemProvider>
                </Scene>
            </GameSceneDetailContext.Provider>
            {!hideHud && <GameHud flags={flags} noWeather={noWeather} />}
        </div>
    );
}
