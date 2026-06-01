'use client';

import { cx } from '@gredice/ui/utils';
import {
    type HTMLAttributes,
    Suspense,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { Controls } from './controls/Controls';
import { Bees } from './entities/bees/Bees';
import { Cats } from './entities/cats/Cats';
import { EntityFactory } from './entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from './entities/EntityInstances';
import { RaisedBedMulchOverlays } from './entities/raisedBed/RaisedBedMulchOverlays';
import type { GameFeatureFlags } from './GameFlagsContext';
import { GameHud } from './GameHud';
import { useGameLoading } from './GameLoadingContext';
import { GameSceneDetailContext } from './GameSceneDetailContext';
import {
    defaultGameCameraPosition,
    defaultGameCameraZoom,
    farGameCameraZoom,
} from './gameCamera';
import { useBlockData } from './hooks/useBlockData';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useDeferredSceneDetails } from './hooks/useDeferredSceneDetails';
import { useFocusPlacedBlock } from './hooks/useFocusPlacedBlock';
import { useWeatherNow } from './hooks/useWeatherNow';
import { DebugHud } from './hud/DebugHud';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import { PlacementGrid } from './indicators/PlacementGrid';
import { ParticleSystemProvider } from './particles/ParticleSystem';
import { Environment } from './scene/Environment';
import {
    type GameQualityAutoProfileMetrics,
    type GameQualityTier,
    getGameQualityAutoProfileMetrics,
    resolveGameQualityProfile,
} from './scene/gameQuality';
import { Scene } from './scene/Scene';
import { type GameState, useGameState, type WinterMode } from './useGameState';
import { useRaisedBedCloseup } from './useRaisedBedCloseup';

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string;
    spriteBaseUrl?: string;
    zoom?: 'far' | 'normal';
    cameraPosition?: [x: number, y: number, z: number];

    // Demo purposes only
    freezeTime?: Date;
    dayNightCycleDisabled?: boolean;
    noBackground?: boolean;
    noControls?: boolean;
    hideHud?: boolean;
    noWeather?: boolean;
    noSound?: boolean;
    mockGarden?: boolean;
    winterMode?: WinterMode;
    weather?: Partial<GameState['weather']>;
    deferDetails?: boolean;
    quality?: GameQualityTier;

    // Development purposes
    flags?: GameFeatureFlags;
};

function useAutoQualityProfileMetrics(enabled: boolean) {
    const [metrics, setMetrics] = useState<
        GameQualityAutoProfileMetrics | undefined
    >(getGameQualityAutoProfileMetrics);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return;
        }

        let resolutionQuery: MediaQueryList | undefined;
        const refresh = () => setMetrics(getGameQualityAutoProfileMetrics());
        const handleResolutionChange = () => {
            refresh();
            subscribeResolutionChange();
        };
        const subscribeResolutionChange = () => {
            resolutionQuery?.removeEventListener(
                'change',
                handleResolutionChange,
            );

            if (typeof window.matchMedia !== 'function') {
                resolutionQuery = undefined;
                return;
            }

            resolutionQuery = window.matchMedia(
                `(resolution: ${window.devicePixelRatio || 1}dppx)`,
            );
            resolutionQuery.addEventListener('change', handleResolutionChange);
        };

        subscribeResolutionChange();
        window.addEventListener('resize', refresh);
        window.addEventListener('orientationchange', refresh);

        return () => {
            resolutionQuery?.removeEventListener(
                'change',
                handleResolutionChange,
            );
            window.removeEventListener('resize', refresh);
            window.removeEventListener('orientationchange', refresh);
        };
    }, [enabled]);

    return metrics;
}

export function GameScene({
    cameraPosition = defaultGameCameraPosition,
    zoom = 'normal',
    noControls,
    noWeather,
    noBackground,
    noSound,
    hideHud,
    className,
    flags,
    quality,
    weather,
    deferDetails,
    ...rest
}: GameSceneProps) {
    useFocusPlacedBlock();
    useRaisedBedCloseup();
    const weatherVisualizationDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const gameQualitySetting = useGameState(
        (state) => state.gameQualitySetting,
    );
    const gameQualityCustomProfile = useGameState(
        (state) => state.gameQualityCustomProfile,
    );
    const weatherDisabled = noWeather || weatherVisualizationDisabled;
    const renderDetails = useDeferredSceneDetails(deferDetails);
    const autoQualityProfileMetrics = useAutoQualityProfileMetrics(
        quality === undefined && gameQualitySetting === 'auto',
    );
    const qualityProfile = useMemo(() => {
        return resolveGameQualityProfile(
            quality ?? gameQualitySetting,
            gameQualityCustomProfile,
            autoQualityProfileMetrics,
        );
    }, [
        autoQualityProfileMetrics,
        gameQualityCustomProfile,
        gameQualitySetting,
        quality,
    ]);

    // Start non-critical metadata early, but don't block the first scene frame.
    useBlockData();
    const { data: garden, isLoading: gardenLoading } = useCurrentGarden();
    useWeatherNow(!weatherDisabled && !weather);
    const isLoading = gardenLoading;

    const loadingContext = useGameLoading();
    useEffect(() => {
        loadingContext?.setIsReady(!isLoading);
        return () => {
            loadingContext?.setIsReady(false);
        };
    }, [isLoading, loadingContext]);

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
                    position={cameraPosition}
                    quality={qualityProfile}
                    zoom={
                        zoom === 'far'
                            ? farGameCameraZoom
                            : defaultGameCameraZoom
                    }
                    className="!absolute"
                >
                    <ParticleSystemProvider>
                        <PlacementGrid />
                        <Environment
                            noBackground={noBackground}
                            noWeather={weatherDisabled}
                            noSound={noSound}
                            quality={qualityProfile}
                            weather={weather}
                        />
                        <group>
                            {garden?.stacks.map((stack) =>
                                stack.blocks?.map((block, i) => (
                                    <Suspense
                                        // biome-ignore lint/suspicious/noArrayIndexKey: Using array index as key is acceptable here because block IDs are unique within a stack, and the order of blocks within a stack is unlikely to change. Using block.id alone is not sufficient as it may not be unique across different stacks.
                                        key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.id}-${block.name}-${i}`}
                                        fallback={null}
                                    >
                                        <EntityFactory
                                            name={block.name}
                                            stack={stack}
                                            block={block}
                                            stacks={garden.stacks}
                                            rotation={block.rotation}
                                            variant={block.variant}
                                            noRenderInView={instancedBlockNames}
                                            noControl={noControls}
                                        />
                                    </Suspense>
                                )),
                            )}
                            {renderDetails && zoom !== 'far' && (
                                <Suspense fallback={null}>
                                    <RaisedBedMulchOverlays
                                        quality={qualityProfile}
                                    />
                                </Suspense>
                            )}
                            <EntityInstances
                                quality={qualityProfile}
                                renderGroundDecorations={
                                    renderDetails && zoom !== 'far'
                                }
                                stacks={garden?.stacks}
                                renderDetails={renderDetails}
                            />
                            {renderDetails && zoom !== 'far' && (
                                <Suspense fallback={null}>
                                    <Cats
                                        stacks={garden?.stacks}
                                        weather={weather}
                                        weatherDisabled={weatherDisabled}
                                    />
                                </Suspense>
                            )}
                            {renderDetails && zoom !== 'far' && (
                                <Suspense fallback={null}>
                                    <Bees
                                        garden={garden}
                                        groundDecorationDensity={
                                            qualityProfile.groundDecorationDensity
                                        }
                                        weather={weather}
                                        weatherDisabled={weatherDisabled}
                                    />
                                </Suspense>
                            )}
                        </group>
                        {!noControls && <Controls />}
                    </ParticleSystemProvider>
                </Scene>
            </GameSceneDetailContext.Provider>
            {!hideHud && <GameHud flags={flags} noWeather={noWeather} />}
            {hideHud && Boolean(flags?.enableDebugHudFlag) && <DebugHud />}
        </div>
    );
}
