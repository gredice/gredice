'use client';

import { cx } from '@signalco/ui-primitives/cx';
import type { HTMLAttributes } from 'react';
import { Controls } from './controls/Controls';
import { EntityFactory } from './entities/EntityFactory';
import {
    EntityInstances,
    instancedBlockNames,
} from './entities/EntityInstances';
import { GameHud } from './GameHud';
import { useBlockData } from './hooks/useBlockData';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useFocusPlacedBlock } from './hooks/useFocusPlacedBlock';
import { useGameTimeManager } from './hooks/useGameTimeManager';
import { useThemeManager } from './hooks/useThemeManager';
import { useWeatherNow } from './hooks/useWeatherNow';
import { EditModeGrid } from './indicators/EditModeGrid';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import { ParticleSystemProvider } from './particles/ParticleSystem';
import { Environment } from './scene/Environment';
import { Scene } from './scene/Scene';
import type { GameState, WinterMode } from './useGameState';
import { useRaisedBedCloseup } from './useRaisedBedCloseup';

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string;
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

    // Development purposes
    flags?: {
        enableDebugHudFlag?: boolean;
        enableRaisedBedWateringFlag?: boolean;
        enableRaisedBedDiaryFlag?: boolean;
        enableRaisedBedOperationsFlag?: boolean;
        enableRaisedBedFieldOperationsFlag?: boolean;
        enableRaisedBedFieldWateringFlag?: boolean;
        enableRaisedBedFieldDiaryFlag?: boolean;
    };
};

const cameraPosition: [x: number, y: number, z: number] = [-100, 100, -100];

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
    ...rest
}: GameSceneProps) {
    useGameTimeManager();
    useThemeManager();
    useFocusPlacedBlock();
    useRaisedBedCloseup();

    // Prelaod all required data
    const { isLoading: blockDataPending } = useBlockData();
    const { data: garden, isLoading: gardenPending } = useCurrentGarden();
    const { isLoading: weatherPending } = useWeatherNow(!noWeather);
    const isLoading = gardenPending || blockDataPending || weatherPending;
    if (isLoading) {
        return <GardenLoadingIndicator />;
    }

    return (
        <div
            className={cx('animate-in duration-1000 fade-in', className)}
            {...rest}
        >
            <Scene
                position={cameraPosition}
                zoom={zoom === 'far' ? 75 : 100}
                className="!absolute"
            >
                <ParticleSystemProvider>
                    <EditModeGrid />
                    <Environment
                        noBackground={noBackground}
                        noWeather={noWeather}
                        noSound={noSound}
                        weather={weather}
                    />
                    <group>
                        {garden?.stacks.map((stack) =>
                            stack.blocks?.map((block, i) => (
                                <EntityFactory
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
                        <EntityInstances stacks={garden?.stacks} />
                    </group>
                    {!noControls && <Controls />}
                </ParticleSystemProvider>
            </Scene>
            {!hideHud && <GameHud flags={flags} />}
        </div>
    );
}
