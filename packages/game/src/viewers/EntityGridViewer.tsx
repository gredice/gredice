'use client';

import { Html, OrbitControls } from '@react-three/drei';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef } from 'react';
import { MOUSE, Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { EntityFactory } from '../entities/EntityFactory';
import { entityNameMap } from '../entities/entityNameMap';
import { GameFlagsContext } from '../GameFlagsContext';
import { DebugHud } from '../hud/DebugHud';
import { Environment } from '../scene/Environment';
import { Scene } from '../scene/Scene';
import type { Block } from '../types/Block';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../useGameState';

export type EntityGridViewerProps = {
    className?: string;
    /**
     * Number of columns in the grid
     * @default 6
     */
    columns?: number;
    /**
     * Spacing between entities
     * @default 5
     */
    spacing?: number;
    /**
     * Zoom level of the camera
     * @default 28
     */
    zoom?: number;
    debugHud?: boolean;
    showBackground?: boolean;
};

export function EntityGridViewer({
    className,
    columns = 6,
    spacing = 5,
    zoom = 28,
    debugHud,
    showBackground,
}: EntityGridViewerProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: '',
            dayNightCycleDisabled: false,
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            winterMode: 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

    const client = new QueryClient();

    const entityNames = Object.keys(entityNameMap);
    const entities = entityNames.map((entityName, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);

        let variant: number | undefined;
        if (entityName === 'PineAdvent') {
            variant = 100;
        }

        const block: Block = {
            id: uuidv4(),
            name: entityName,
            rotation: 0,
            variant: variant,
        };

        const position = new Vector3(col * spacing, 0, row * spacing);
        const stack = {
            position,
            blocks: [block],
        };

        return { entityName, stack, block, variant, position };
    });

    // Calculate camera position to center on the grid
    const rows = Math.ceil(entityNames.length / columns);
    const centerX = ((columns - 1) * spacing) / 2;
    const centerZ = ((rows - 1) * spacing) / 2;

    return (
        <QueryClientProvider client={client}>
            <GameStateContext.Provider value={storeRef.current}>
                <GameFlagsContext.Provider
                    value={{
                        enableDebugHudFlag: debugHud,
                        enableRainWetOverlayFlag: debugHud,
                    }}
                >
                    <Scene position={100} zoom={zoom} className={className}>
                        <Environment
                            noBackground={!showBackground}
                            noSound
                            noWeather
                        />
                        <OrbitControls
                            enableDamping
                            screenSpacePanning={false}
                            minZoom={10}
                            maxZoom={120}
                            mouseButtons={{
                                LEFT: MOUSE.PAN,
                                MIDDLE: MOUSE.DOLLY,
                                RIGHT: MOUSE.ROTATE,
                            }}
                        />
                        <group position={[-centerX, 0, -centerZ]}>
                            {entities.map(
                                ({
                                    entityName,
                                    stack,
                                    block,
                                    variant,
                                    position,
                                }) => (
                                    <group key={entityName}>
                                        <EntityFactory
                                            name={entityName}
                                            stack={stack}
                                            block={block}
                                            rotation={0}
                                            variant={variant}
                                        />
                                        <Html
                                            position={[
                                                position.x + 0.5,
                                                -0.5,
                                                position.z + 0.5,
                                            ]}
                                            center
                                            distanceFactor={15}
                                            style={{ pointerEvents: 'none' }}
                                        >
                                            <div className="text-white text-xs bg-black/70 px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                                                {entityName}
                                            </div>
                                        </Html>
                                    </group>
                                ),
                            )}
                        </group>
                    </Scene>
                    {debugHud && <DebugHud />}
                </GameFlagsContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
