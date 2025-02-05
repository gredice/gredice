'use client';

import { Vector3 } from 'three';
import { OrbitControls } from '@react-three/drei';
import { HTMLAttributes, useEffect, useRef } from 'react';
import { Environment } from './scene/Environment';
import { useGameState } from './useGameState';
import type { Stack } from './types/Stack';
import type { Garden } from './types/Garden';
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

// function serializeGarden(garden: Garden) {
//     return JSON.stringify(garden);
// }

// function deserializeGarden(serializedGarden: string): Garden {
//     const garden = JSON.parse(serializedGarden) as RecursivePartial<Garden>;

//     if (!garden.name) {
//         garden.name = getDefaultGarden().name;
//     }
//     if (!garden.location || !garden.location.lat || !garden.location.lon) {
//         garden.location = getDefaultGarden().location;
//     }

//     // Deserialize stacks
//     garden.stacks = garden.stacks?.map(stack => {
//         stack.position = new Vector3(stack.position?.x, stack.position?.y, stack.position?.z);
//         return stack;
//     });

//     return garden as Garden;
// }

function getDefaultGarden(): Garden {
    const size = 1;
    const stacks: Stack[] = [];
    for (let x = -size; x <= size + 1; x++) {
        for (let z = -size; z <= size; z++) {
            stacks.push({
                position: new Vector3(x, 0, z),
                blocks: [
                    { name: "Block_Grass", rotation: Math.floor(Math.random() * 4) },
                ]
            });
        }
    }
    stacks.find(stack => stack.position.x === 0 && stack.position.z === 0)?.blocks.push({ name: "Raised_Bed", rotation: 1 });
    stacks.find(stack => stack.position.x === 1 && stack.position.z === 0)?.blocks.push({ name: "Raised_Bed", rotation: 1 });

    return {
        name: 'Moj vrt',
        stacks,
        location: {
            lat: 45.739,
            lon: 16.572
        }
    };
}

// TODO: Use to deserialize
// async function getGarden() {
//     const serializedGarden = localStorage.getItem(gardenLocalStorageKey);
//     if (serializedGarden) {
//         return deserializeGarden(serializedGarden);
//     } else {
//         const newGarden = deserializeGarden(serializeGarden(getDefaultGarden()));
//         localStorage.setItem(gardenLocalStorageKey, serializeGarden(newGarden));
//         return newGarden;
//     }
// }

export function GardenDisplay({ noBackground }: { noBackground?: boolean }) {
    const stacks = useGameState(state => state.stacks);
    const setStacks = useGameState(state => state.setStacks);

    // TODO: Load garden from remote
    const garden = getDefaultGarden();
    const isLoadingGarden = false;
    useEffect(() => {
        // Only update local state if we don't have any local state (first load or no stacks)
        if (garden && !isLoadingGarden && stacks.length <= 0) {
            setStacks(garden.stacks);
        }

        // TODO: Check if we are ou-of-sync with remote state and
        //       present user with "Reload" button (notification)
    }, [garden, isLoadingGarden]);

    // TODO: Update garden remote state when local stage changes

    if (!garden) {
        return null;
    }

    return (
        <>
            <Environment noBackground={noBackground} location={garden.location} />
            <group>
                {stacks.map((stack) =>
                    stack.blocks?.map((block, i) => {
                        return (
                            <EntityFactory
                                key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.name}-${i}`}
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

    const currentTime = useGameState(state => state.currentTime);
    const isDay = currentTime.getHours() > 6 && currentTime.getHours() < 18;

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

function beginPanCamera(direction: [number, number]) {
    const orbitControls = useGameState.getState().orbitControls;
    if (!orbitControls) return;

    // TODO: Use frame loop instead of setInterval
    const pan = new Vector3(direction[0], 0, direction[1]).divideScalar(5);
    const intervalToken = setInterval(() => {
        orbitControls.target.add(pan);
    }, 1000 / 60);
    return intervalToken;
}

function endPanCamera(intervalToken: NodeJS.Timeout) {
    clearInterval(intervalToken);
}

function rotateCamera(direction: 'ccw' | 'cw' = 'cw') {
    const orbitControls = useGameState.getState().orbitControls;
    if (!orbitControls) return;

    // Rotate by 90 degrees
    orbitControls.setAzimuthalAngle(
        orbitControls.getAzimuthalAngle() +
        (direction === 'cw' ? Math.PI / 2 : -Math.PI / 2)
    );
}

const useKeyboardControls = () => {
    // TODO: Disable rotation when modal is open

    const rotateKeys: Record<string, 'cw' | 'ccw'> = {
        KeyQ: 'cw',
        KeyW: 'ccw',
    }

    const panKeys: Record<string, [number, number]> = {
        ArrowUp: [-1, -1],
        ArrowDown: [1, 1],
        ArrowLeft: [-1, 1],
        ArrowRight: [1, -1],
    }

    const rotateValueByKey = (key: string) => rotateKeys[key];
    const currentPanIntervalToken = useRef<Map<string, NodeJS.Timeout>>(new Map());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

            const rotateValue = rotateValueByKey(e.code);
            if (rotateValue) rotateCamera(rotateValue);

            const panValue = panKeys[e.code];
            if (panValue) {
                if (currentPanIntervalToken.current.has(e.code)) return;
                const token = beginPanCamera(panValue);
                if (token) {
                    currentPanIntervalToken.current.set(e.code, token);
                }
            }
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            const panValue = panKeys[e.code];
            if (panValue) {
                const token = currentPanIntervalToken.current.get(e.code);
                if (token) {
                    endPanCamera(token);
                    currentPanIntervalToken.current.delete(e.code);
                }
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keyup', handleKeyUp)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('keyup', handleKeyUp)
        }
    }, []);
}

function RotateIcons() {
    return (
        <div className='absolute bottom-2 left-2'>
            <Row>
                <IconButton title="Okreni lijevo" variant='plain' onClick={rotateCamera.bind(null, 'ccw')}>
                    <Undo className='size-5' />
                </IconButton>
                <IconButton title="Okreni desno" variant='plain' onClick={rotateCamera.bind(null, 'cw')}>
                    <Redo className='size-5' />
                </IconButton>
            </Row>
        </div>
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
    const cameraPosition = 100;
    useKeyboardControls();

    return (
        <div {...rest}>
            <CurrentTimeManager freezeTime={freezeTime} />
            <ThemeChanger />
            <Scene
                appBaseUrl={appBaseUrl}
                freezeTime={freezeTime}
                position={cameraPosition}
                zoom={zoom === 'far' ? 75 : 100}
                className='!absolute'
            >
                {isDevelopment && <DebugHud />}
                <GardenDisplay noBackground={noBackground} />
                <OrbitControls
                    ref={useGameState.getState().setOrbitControls}
                    enableRotate={false}
                    onStart={() => useGameState.getState().setIsDragging(true)}
                    onEnd={() => useGameState.getState().setIsDragging(false)}
                    minZoom={50}
                    maxZoom={200} />
            </Scene>
            {!hideHud && (
                <>
                    <AccountHud />
                    <SunflowersHud />
                    <WeatherHud />
                    <DayNightCycleHud lat={45.739} lon={16.572} />
                </>
            )}
            <OverviewModal />
            {!hideHud && (
                <RotateIcons />
            )}
        </div>
    );
}