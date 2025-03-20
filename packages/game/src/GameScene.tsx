'use client';

import { HTMLAttributes, useRef, useState } from 'react';
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
import { GardenDisplay } from './GardenDisplay';
import { useThemeManager } from './hooks/useThemeManager';
import { useGameTimeManager } from './hooks/useGameTimeManager';
import { AudioHud } from './hud/AudioHud';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { GardenLoadingIndicator } from './GardenLoadingIndicator';
import { cx } from '@signalco/ui-primitives/cx';
import { Html } from '@react-three/drei';
import { CameraController } from './controllers/CameraController';
import { useControls } from 'leva';

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string,
    zoom?: 'far' | 'normal',

    // Demo purposes only
    freezeTime?: Date,
    noBackground?: boolean,
    hideHud?: boolean,
    noWeather?: boolean,
    noSound?: boolean,
    mockGarden?: boolean,

    isDevelopment?: boolean,
}

export function GameScene({
    appBaseUrl,
    isDevelopment,
    zoom = 'normal',
    mockGarden,
    freezeTime,
    noWeather,
    noBackground,
    noSound,
    hideHud,
    className,
    ...rest
}: GameSceneProps) {
    const cameraPosition: [x: number, y: number, z: number] = [-100, 100, -100];
    const { isLoading } = useCurrentGarden(mockGarden);
    useGameTimeManager(freezeTime);
    useThemeManager();

    if (isLoading) {
        return (
            <GardenLoadingIndicator {...rest} />
        );
    }

    return (
        <div className={cx('fade-in', className)} {...rest}>
            <Scene
                appBaseUrl={appBaseUrl}
                freezeTime={freezeTime}
                position={cameraPosition}
                zoom={zoom === 'far' ? 75 : 100}
                className='!absolute'
            >
                {isDevelopment && <DebugHud />}
                <GardenDisplay
                    noBackground={noBackground}
                    mockGarden={mockGarden}
                    noWeather={noWeather}
                    noSound={noSound}
                />
                <Controls isDevelopment={isDevelopment} />
            </Scene>
            {!hideHud && (
                <>
                    <AccountHud />
                    <DayNightCycleHud lat={45.739} lon={16.572} />
                    <div className='absolute top-2 right-2 flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2'>
                        <WeatherHud />
                        <SunflowersHud />
                    </div>
                    <div className='absolute bottom-0 flex flex-col left-0 right-0 md:flex-row md:justify-between md:items-end pointer-events-none'>
                        <div className='p-2 flex flex-row'>
                            <CameraHud />
                            <AudioHud />
                        </div>
                        <ItemsHud />
                        <div className='hidden md:block' />
                    </div>
                    <OverviewModal />
                </>
            )}
        </div>
    );
}