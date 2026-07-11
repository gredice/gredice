'use client';

import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type HTMLAttributes, useEffect, useRef } from 'react';
import { MOUSE, Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { EntityFactory } from '../entities/EntityFactory';
import { GameFlagsContext } from '../GameFlagsContext';
import { GameSceneDetailContext } from '../GameSceneDetailContext';
import { DebugHud } from '../hud/DebugHud';
import { ParticleSystemProvider } from '../particles/ParticleSystem';
import { Environment, StaticEnvironment } from '../scene/Environment';
import type { GameQualityProfile } from '../scene/gameQuality';
import { Scene } from '../scene/Scene';
import type { Block } from '../types/Block';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../useGameState';

const position = new Vector3(0.5, 0, 0.5);

export type EntityViewerProps = HTMLAttributes<HTMLDivElement> & {
    entityName: string;
    appBaseUrl?: string;
    className?: string;
    noControl?: boolean;
    staticEnvironment?: boolean;
    debugHud?: boolean;
    renderDetails?: boolean;
    showBackground?: boolean;
    /**
     * Zoom level of the camera
     * @default 90
     */
    zoom?: number;
    itemPosition?: [number, number, number];
    /**
     * Rotation of the rendered entity. Values map to quarter turns clockwise.
     * @default 0
     */
    rotation?: number;
    /**
     * Optional render quality override. When omitted the scene auto-detects the
     * quality profile. Used by snapshot generation to render at a higher dpr.
     */
    quality?: GameQualityProfile;
    /**
     * Optional camera position for generated previews that need a specific
     * viewing angle instead of the default game snapshot angle.
     */
    cameraPosition?: [number, number, number];
    cameraTarget?: [number, number, number];
};

function CameraLookAt({ target }: { target: [number, number, number] }) {
    const camera = useThree((state) => state.camera);

    useEffect(() => {
        camera.lookAt(target[0], target[1], target[2]);
        camera.updateProjectionMatrix();
    }, [camera, target]);

    return null;
}

export function EntityViewer({
    appBaseUrl,
    entityName,
    zoom,
    itemPosition,
    className,
    noControl,
    staticEnvironment,
    debugHud,
    renderDetails = true,
    showBackground,
    rotation = 0,
    quality,
    cameraPosition,
    cameraTarget,
    ...rest
}: EntityViewerProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            dayNightCycleDisabled: false,
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            winterMode: 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

    const client = new QueryClient();
    const normalizedRotation = ((rotation % 4) + 4) % 4;
    let variant: number | undefined;
    if (entityName === 'PineAdvent') {
        variant = 100;
    }
    const block: Block = {
        id: uuidv4(),
        name: entityName,
        rotation: normalizedRotation,
        variant: variant,
    };
    const stack = {
        position: itemPosition
            ? new Vector3(itemPosition[0], itemPosition[1], itemPosition[2])
            : position,
        blocks: [block],
    };
    const orbitTarget: [number, number, number] = itemPosition ?? [0.5, 0, 0.5];
    const sceneChildren = (
        <>
            {staticEnvironment ? (
                <StaticEnvironment noBackground={!showBackground} />
            ) : (
                <Environment noBackground={!showBackground} noSound noWeather />
            )}
            {cameraTarget && <CameraLookAt target={cameraTarget} />}
            <EntityFactory
                name={entityName}
                stack={stack}
                block={block}
                noControl={noControl}
                rotation={normalizedRotation}
                variant={variant}
            />
            {!noControl && (
                <OrbitControls
                    enableDamping
                    screenSpacePanning={false}
                    minZoom={20}
                    maxZoom={220}
                    target={orbitTarget}
                    mouseButtons={{
                        LEFT: MOUSE.PAN,
                        MIDDLE: MOUSE.DOLLY,
                        RIGHT: MOUSE.ROTATE,
                    }}
                />
            )}
        </>
    );

    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={storeRef.current}>
                <GameFlagsContext.Provider
                    value={{
                        enableDebugHudFlag: debugHud,
                        enableRainWetOverlayFlag: debugHud,
                    }}
                >
                    <GameSceneDetailContext.Provider
                        value={{
                            includePendingCartPlants: false,
                            renderDetails,
                        }}
                    >
                        <Scene
                            debugStats={debugHud}
                            position={cameraPosition ?? 100}
                            zoom={zoom ?? 90}
                            quality={quality}
                            className={className}
                            {...rest}
                        >
                            <ParticleSystemProvider>
                                {sceneChildren}
                            </ParticleSystemProvider>
                        </Scene>
                    </GameSceneDetailContext.Provider>
                    {debugHud && <DebugHud />}
                </GameFlagsContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
