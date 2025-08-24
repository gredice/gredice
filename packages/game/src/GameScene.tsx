'use client';

import { cx } from '@signalco/ui-primitives/cx';
import type { HTMLAttributes } from 'react';
import { Controls } from './controls/Controls';
import { EntityFactory } from './entities/EntityFactory';
import { GameHud } from './GameHud';
import { useBlockData } from './hooks/useBlockData';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useGameTimeManager } from './hooks/useGameTimeManager';
import { useThemeManager } from './hooks/useThemeManager';
import { useWeatherNow } from './hooks/useWeatherNow';
import { EditModeGrid } from './indicators/EditModeGrid';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import { Environment } from './scene/Environment';
import { Scene } from './scene/Scene';

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

    // Development purposes
    flags?: {
        enableDebugHudFlag?: boolean;
        enableDebugCloseupFlag?: boolean;
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
    ...rest
}: GameSceneProps) {
    useGameTimeManager();
    useThemeManager();

    // Prelaod all required data
    const { isLoading: blockDataPending } = useBlockData();
    const { data: garden, isLoading: gardenPending } = useCurrentGarden();
    const { isLoading: weatherPending } = useWeatherNow();
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
                <EditModeGrid />
                <Environment
                    noBackground={noBackground}
                    noWeather={noWeather}
                    noSound={noSound}
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
                            />
                        )),
                    )}
                </group>
                {!noControls && (
                    <Controls
                        debugCloseup={Boolean(flags?.enableDebugCloseupFlag)}
                    />
                )}
            </Scene>
            {!hideHud && <GameHud flags={flags} />}
        </div>
    );
}
