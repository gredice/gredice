'use client';

import { HTMLAttributes } from 'react';
import { Scene } from './scene/Scene';
import { Controls } from './controls/Controls';
import { useThemeManager } from './hooks/useThemeManager';
import { useGameTimeManager } from './hooks/useGameTimeManager';
import { cx } from '@signalco/ui-primitives/cx';
import { EntityFactory } from './entities/EntityFactory';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import { Environment } from './scene/Environment';
import { useBlockData } from './hooks/useBlockData';
import { useWeatherNow } from './hooks/useWeatherNow';
import { EditModeGrid } from './indicators/EditModeGrid';
import { GameHud } from './GameHud';

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

    return (
        <div className={cx('animate-in duration-1000 fade-in', className)} {...rest}>
            <Scene
                position={cameraPosition}
                zoom={zoom === 'far' ? 75 : 100}
                className='!absolute'
            >
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
            {!hideHud && <GameHud flags={flags} />}
        </div>
    );
}
