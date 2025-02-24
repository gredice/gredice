'use client';

import { HTMLAttributes } from 'react';
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
    ...rest
}: GameSceneProps) {
    const cameraPosition: [x: number, y: number, z: number] = [-100, 100, -100];

    useGameTimeManager(freezeTime);
    useThemeManager();

    return (
        <div {...rest}>
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
                <Controls />
            </Scene>
            {!hideHud && (
                <>
                    <AccountHud />
                    <DayNightCycleHud lat={45.739} lon={16.572} />
                    <div className='absolute top-2 right-2 flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2'>
                        <WeatherHud />
                        <SunflowersHud />
                    </div>
                    <div className='absolute bottom-0 flex flex-col left-0 right-0 md:flex-row md:justify-between md:items-end'>
                        <div className='p-2'>
                            <CameraHud />
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