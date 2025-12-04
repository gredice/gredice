'use client';

import { cx } from '@signalco/ui-primitives/cx';
import { useSearchParams } from 'next/navigation';
// import { Perf } from 'r3f-perf';
import { type HTMLAttributes, useEffect, useMemo } from 'react';
import { Controls } from './controls/Controls';
import { EntityFactory } from './entities/EntityFactory';
import { EntityInstances } from './entities/EntityInstances';
import { GameHud } from './GameHud';
import { useBlockData } from './hooks/useBlockData';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useGameTimeManager } from './hooks/useGameTimeManager';
import { useThemeManager } from './hooks/useThemeManager';
import { useWeatherNow } from './hooks/useWeatherNow';
import { EditModeGrid } from './indicators/EditModeGrid';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import { ParticleSystemProvider } from './particles/ParticleSystem';
import { Environment } from './scene/Environment';
import { Scene } from './scene/Scene';
import { type GameState, useGameState } from './useGameState';

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
    isWinterMode?: boolean;
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

// TODO: Move all blocks to instanced rendering
const noRenderInViewDefault = [
    'Block_Grass',
    'Block_Grass_Angle',
    'Block_Sand',
    'Block_Sand_Angle',
    'Block_Snow',
    'Block_Snow_Angle',
    'Bush',
    'Pine',
    'Tree',
    'ShovelSmall',
    'MulchHey',
    'MulchCoconut',
    'MulchWood',
    'Tulip',
    'BaleHey',
    'Stick',
    'Seed',
    'StoneSmall',
    'StoneMedium',
    'StoneLarge',
];

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

    // Prelaod all required data
    const { isLoading: blockDataPending } = useBlockData();
    const { data: garden, isLoading: gardenPending } = useCurrentGarden();
    const { isLoading: weatherPending } = useWeatherNow(!noWeather);
    useRaisedBedCloseup(garden);
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
                                    noRenderInView={noRenderInViewDefault}
                                />
                            )),
                        )}
                        <EntityInstances stacks={garden?.stacks} />
                    </group>
                    {!noControls && <Controls />}
                    {/* {!hideHud && <Perf position="bottom-right" />} */}
                </ParticleSystemProvider>
            </Scene>
            {!hideHud && <GameHud flags={flags} />}
        </div>
    );
}

function useRaisedBedCloseup(
    garden: ReturnType<typeof useCurrentGarden>['data'],
) {
    const searchParams = useSearchParams();
    const setView = useGameState((state) => state.setView);
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const view = useGameState((state) => state.view);

    const blocks = useMemo(
        () => garden?.stacks.flatMap((stack) => stack.blocks) ?? [],
        [garden],
    );

    useEffect(() => {
        const raisedBedParam = searchParams?.get('gredica');
        if (!garden || !raisedBedParam) {
            return;
        }

        const decodedRaisedBedName =
            decodeUriComponentSafe(raisedBedParam).trim();
        if (!decodedRaisedBedName) {
            return;
        }

        const raisedBed = garden.raisedBeds.find(
            (bed) =>
                bed.name?.trim().toLowerCase() ===
                decodedRaisedBedName.toLowerCase(),
        );
        if (!raisedBed) {
            return;
        }

        const block = blocks.find(
            (candidate) => String(candidate.id) === String(raisedBed.blockId),
        );
        if (!block) {
            return;
        }

        if (view === 'closeup' && closeupBlock?.id === block.id) {
            return;
        }

        setView({ view: 'closeup', block });
    }, [blocks, closeupBlock?.id, garden, searchParams, setView, view]);
}

function decodeUriComponentSafe(value: string) {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        console.error('Failed to decode URI component', error);
        return value;
    }
}
