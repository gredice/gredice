'use client';

import { HTMLAttributes, useRef } from 'react';
import { Scene } from './scene/Scene';
import { DayNightCycleHud } from './hud/DayNightCycleHud';
import { DebugHud } from './hud/DebugHud';
import { AccountHud } from './hud/AccountHud';
import { SunflowersHud } from './hud/SunflowersHud';
import { OverviewModal } from './modals/OverviewModal';
import { WeatherHud } from './hud/WeatherHud';
import { ItemsHud } from './hud/ItemsHud';
import { Controls } from './controls/Controls';
import { CameraHud } from './hud/CameraHud';
import { useThemeManager } from './hooks/useThemeManager';
import { useGameTimeManager } from './hooks/useGameTimeManager';
import { AudioHud } from './hud/AudioHud';
import { cx } from '@signalco/ui-primitives/cx';
import { useIsEditMode } from './hooks/useIsEditMode';
import { GameModeHud } from './hud/GameModeHud';
import { createGameState, GameStateContext, GameStateStore, useGameState } from './useGameState';
import { useGLTF } from '@react-three/drei';
import { models } from './data/models';
import { WelcomeMessage } from './hud/WelcomeMessage';
import { EntityFactory } from './entities/EntityFactory';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { GardenLoadingIndicator } from './GardenLoadingIndicator';
import { Environment } from './scene/Environment';
import { ShoppingCartHud } from './hud/ShoppingCartHud';
import { RaisedBedFieldHud } from './hud/RaisedBedFieldHud';
import { useBlockData } from './hooks/useBlockData';
import { useWeatherNow } from './hooks/useWeatherNow';
import { PaymentSuccessfulMessage } from './hud/PaymentSuccessfulMessage';

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string,
    zoom?: 'far' | 'normal',

    // Demo purposes only
    freezeTime?: Date,
    noBackground?: boolean,
    noControls?: boolean,
    hideHud?: boolean,
    noWeather?: boolean,
    noSound?: boolean,
    mockGarden?: boolean,

    // Development purposes
    flags?: {
        enableDebugHudFlag?: boolean
        enableDebugCloseupFlag?: boolean,
        enableRaisedBedWateringFlag?: boolean,
        enableRaisedBedDiaryFlag?: boolean,
        enableRaisedBedOperationsFlag?: boolean,
        enableRaisedBedFieldOperationsFlag?: boolean,
        enableRaisedBedFieldWateringFlag?: boolean,
        enableRaisedBedFieldDiaryFlag?: boolean,
    }
}

function EditModeGrid() {
    const isEditMode = useIsEditMode();
    const timeOfDay = useGameState(state => state.timeOfDay);
    const isDay = timeOfDay > 0.2 && timeOfDay < 0.8;

    if (!isEditMode) {
        return null;
    }

    return (
        <gridHelper args={[100, 100, isDay ? '#fffdf2' : '#7e889e', isDay ? '#f0ebd5' : '#4f555c']} position={[0.5, 0, 0.5]} />
    );
}

const cameraPosition: [x: number, y: number, z: number] = [-100, 100, -100];

function GameScene({
    zoom = 'normal',
    noControls,
    noWeather,
    noBackground,
    noSound,
    hideHud,
    className,
    flags,
    ...rest
}: GameSceneProps) {
    useGameTimeManager();
    useThemeManager();

    // Prelaod all required data 
    const { isPending: blockDataPending } = useBlockData();
    const { data: garden, isPending: gardenPending } = useCurrentGarden();
    const { isPending: weatherPending } = useWeatherNow();
    const isPending = gardenPending || blockDataPending || weatherPending;
    if (isPending) {
        return (
            <GardenLoadingIndicator />
        );
    }

    console.debug('Game scene render. State:', isPending ? 'loading' : 'ready', 'Garden:', garden ?? '-');

    return (
        <div className={cx('fade-in', className)} {...rest}>
            <Scene
                position={cameraPosition}
                zoom={zoom === 'far' ? 75 : 100}
                className='!absolute'
            >
                {Boolean(flags?.enableDebugHudFlag) && <DebugHud />}
                <EditModeGrid />
                <Environment
                    noBackground={noBackground}
                    noWeather={noWeather}
                    noSound={noSound} />
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
                            />
                        ))
                    )}
                </group>
                {!noControls && (
                    <Controls debugCloseup={Boolean(flags?.enableDebugCloseupFlag)} />
                )}
            </Scene>
            {!hideHud && (
                <>
                    <div className='absolute top-2 left-2 flex flex-col items-start gap-2'>
                        <AccountHud />
                        <GameModeHud />
                        <ShoppingCartHud />
                    </div>
                    <div className='absolute top-2 right-2 flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2'>
                        <WeatherHud />
                        <SunflowersHud />
                    </div>
                    <DayNightCycleHud />
                    <div className='absolute bottom-0 flex flex-col left-0 right-0 md:flex-row md:justify-between md:items-end pointer-events-none'>
                        <div className='p-2 flex flex-row'>
                            <CameraHud />
                            <AudioHud />
                        </div>
                        <ItemsHud />
                        <div className='hidden md:block' />
                    </div>
                    <RaisedBedFieldHud
                        flags={flags}
                    />
                    <OverviewModal />
                    <WelcomeMessage />
                    <PaymentSuccessfulMessage />
                </>
            )}
        </div>
    );
}

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
