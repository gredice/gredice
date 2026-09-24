import { Canvas } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { BlockInteractionRegistryProvider } from '../src/controls/BlockInteractionRegistry';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import type { Stack } from '../src/types/Stack';
import { createGameState, GameStateContext } from '../src/useGameState';
import { SpatialInteractionTargets } from './SpatialInteractionTargets';

const initialStacks: Stack[] = Array.from({ length: 400 }, (_, i) => {
    const x = (i % 20) - 10;
    const z = Math.floor(i / 20) - 10;
    return {
        position: new Vector3(x, 0, z),
        blocks: [{ id: `${x}:${z}`, name: 'Block_Grass', rotation: 0 }],
    };
});

export function SpatialInteractionFixture() {
    const [rotation, setRotation] = useState(1);
    const [hit, setHit] = useState('');
    const queryClient = useMemo(() => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        client.setQueryData(
            ['blocks', 'local'],
            getLocalSandboxBlockData().map((block) =>
                block.information.name === 'Raised_Bed'
                    ? {
                          ...block,
                          attributes: {
                              ...block.attributes,
                              hitboxWidth: 0.4,
                              hitboxDepth: 1.6,
                              hitboxHeight: 0.5,
                          },
                      }
                    : block,
            ),
        );
        return client;
    }, []);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                authenticatedGardenQueriesEnabled: false,
                isMock: true,
                freezeTime: new Date('2026-09-23T12:00:00Z'),
            }),
        [],
    );
    const stacks = useMemo(
        () =>
            initialStacks.map((stack) =>
                stack.position.x === 0 && stack.position.z === 0
                    ? {
                          ...stack,
                          blocks: [
                              ...stack.blocks,
                              { id: 'rotated', name: 'Raised_Bed', rotation },
                          ],
                      }
                    : stack,
            ),
        [rotation],
    );
    return (
        <QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={store}>
                <button
                    type="button"
                    onClick={() => setRotation((value) => 1 - value)}
                >
                    Rotate target
                </button>
                <output data-testid="spatial-hit">{hit}</output>
                <div style={{ width: 600, height: 600 }}>
                    <Canvas
                        orthographic
                        camera={{
                            position: [0, 20, 0],
                            up: [0, 0, -1],
                            zoom: 60,
                        }}
                    >
                        <BlockInteractionRegistryProvider>
                            <SpatialInteractionTargets
                                stacks={stacks}
                                onHit={setHit}
                            />
                        </BlockInteractionRegistryProvider>
                    </Canvas>
                </div>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
