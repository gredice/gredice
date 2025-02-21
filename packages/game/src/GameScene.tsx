'use client';

import { Vector3 } from 'three';
import { HTMLAttributes, useEffect, useRef } from 'react';
import { Environment } from './scene/Environment';
import { useGameState } from './useGameState';
import type { Stack } from './types/Stack';
import { Scene } from './scene/Scene';
import { EntityFactory } from './entities/EntityFactory';
import { DayNightCycleHud } from './hud/DayNightCycleHud';
import { DebugHud } from './hud/DebugHud';
import { AccountHud } from './hud/AccountHud';
import { SunflowersHud } from './hud/SunflowersHud';
import { OverviewModal } from './modals/OverviewModal';
import { WeatherHud } from './hud/WeatherHud';
import { Row } from '@signalco/ui-primitives/Row';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Redo, Undo } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ItemsHud } from './hud/ItemsHud';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { Controls } from './controls/Controls';

export function GardenDisplay({ noBackground }: { noBackground?: boolean }) {
    const stacks = useGameState(state => state.stacks);
    const setGarden = useGameState(state => state.setGarden);

    // TODO: Load garden from remote
    const { data: garden, isLoading: isLoadingGarden } = useCurrentGarden();
    useEffect(() => {
        // Only update local state if we don't have any local state (first load or no stacks)
        if (garden && !isLoadingGarden) {
            const rootStacks = garden.stacks ?? [];
            const stacks: Stack[] = [];

            const xPositions = Object.keys(rootStacks);
            for (const x of xPositions) {
                const yPositions = Object.keys(rootStacks[x]);
                for (const y of yPositions) {
                    const blocks = rootStacks[x][y];
                    stacks.push({
                        position: new Vector3(Number(x), 0, Number(y)),
                        blocks: blocks ? blocks.map((block) => {
                            return {
                                id: block.id,
                                name: block.name,
                                rotation: block.rotation ?? 0,
                                variant: block.variant
                            }
                        }) : []
                    });
                }
            }

            console.log('Setting garden', garden);
            setGarden({
                id: garden.id.toString(),
                name: garden.name,
                stacks: stacks,
                location: {
                    lat: garden.latitude,
                    lon: garden.longitude
                }
            });
        }
    }, [garden, isLoadingGarden]);

    if (!garden) {
        return null;
    }

    return (
        <>
            <Environment noBackground={noBackground} location={{ lat: garden.latitude, lon: garden.longitude }} />
            <group>
                {stacks.map((stack) =>
                    stack.blocks?.map((block, i) => {
                        return (
                            <EntityFactory
                                key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.id}-${block.name}-${i}`}
                                name={block.name}
                                stack={stack}
                                block={block}
                                rotation={block.rotation}
                                variant={block.variant} />
                        );
                    })
                )}
            </group>
        </>
    )
}

export type GameSceneProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string,
    isDevelopment?: boolean,
    zoom?: 'far' | 'normal',
    freezeTime?: Date,
    noBackground?: boolean,
    hideHud?: boolean
}

function ThemeChanger() {
    const { resolvedTheme, setTheme } = useTheme();

    const timeOfDay = useGameState(state => state.timeOfDay);
    const isDay = timeOfDay > 0.2 && timeOfDay < 0.8;

    useEffect(() => {
        if (isDay && resolvedTheme !== 'light') {
            setTheme('light');
        } else if (!isDay && resolvedTheme !== 'dark') {
            setTheme('dark');
        }
    }, [isDay, resolvedTheme]);

    return null;
}

function CurrentTimeManager({ freezeTime }: { freezeTime?: Date }) {
    // Update current time every second
    const setCurrentTime = useGameState((state) => state.setCurrentTime);

    useEffect(() => {
        setCurrentTime(freezeTime ?? new Date());
        const interval = setInterval(() => {
            setCurrentTime(useGameState.getState().freezeTime ?? new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return null;
}

function RotateIcons() {
    const worldRotate = useGameState(state => state.worldRotate);
    return (
        <Row>
            <IconButton title="Okreni lijevo" variant='plain' className='hover:bg-muted' onClick={worldRotate.bind(null, 'ccw')}>
                <Undo className='size-5' />
            </IconButton>
            <IconButton title="Okreni desno" variant='plain' className='hover:bg-muted' onClick={worldRotate.bind(null, 'cw')}>
                <Redo className='size-5' />
            </IconButton>
        </Row>
    )
}

export function GameScene({
    appBaseUrl,
    isDevelopment,
    zoom = 'normal',
    freezeTime,
    noBackground,
    hideHud,
    ...rest
}: GameSceneProps) {
    const cameraPosition: [x: number, y: number, z: number] = [-100, 100, -100];

    return (
        <div {...rest}>
            <ThemeChanger />
            <Scene
                appBaseUrl={appBaseUrl}
                freezeTime={freezeTime}
                position={cameraPosition}
                zoom={zoom === 'far' ? 75 : 100}
                className='!absolute'
            >
                <CurrentTimeManager freezeTime={freezeTime} />
                {isDevelopment && <DebugHud />}
                <GardenDisplay noBackground={noBackground} />
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
                            <RotateIcons />
                        </div>
                        <ItemsHud />
                        <div className='hidden md:block' />
                    </div>
                </>
            )}
            <OverviewModal />
        </div>
    );
}