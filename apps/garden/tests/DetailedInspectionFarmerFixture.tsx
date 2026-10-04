import { Suspense, useCallback, useMemo, useState } from 'react';
import { DetailedInspectionFarmer } from '../../../packages/game/src/entities/avatar/DetailedInspectionFarmer';
import type { DetailedInspectionFarmerTransform } from '../../../packages/game/src/entities/avatar/detailedInspectionFarmerPosition';
import { gameQualityProfiles } from '../../../packages/game/src/scene/gameQuality';
import { Scene } from '../../../packages/game/src/scene/Scene';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import { DetailedInspectionFarmerObserver } from './DetailedInspectionFarmerObserver';

export function DetailedInspectionFarmerFixture() {
    const [opened, setOpened] = useState(false);
    const [position, setPosition] = useState<{
        x: number;
        y: number;
        z: number;
    } | null>(null);
    const gameState = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                freezeTime: new Date('2026-08-11T12:00:00.000Z'),
                isMock: true,
            }),
        [],
    );
    const transform = useMemo<DetailedInspectionFarmerTransform>(
        () => ({
            patrolRoute: [
                { x: -1, y: 0.4, z: 0 },
                { x: -1, y: 0.4, z: 1 },
                { x: 0, y: 0.4, z: 1 },
                { x: 1, y: 0.4, z: 1 },
                { x: 1, y: 0.4, z: 0 },
                { x: 1, y: 0.4, z: -1 },
                { x: 0, y: 0.4, z: -1 },
                { x: -1, y: 0.4, z: -1 },
                { x: -1, y: 0.4, z: 0 },
            ],
            position: [-1, 0.4, 0],
            rotationY: 0,
            world: {
                blockedCells: [{ x: 0, z: 0 }],
                surfaces: Array.from({ length: 9 }, (_, index) => ({
                    kind: 'ground' as const,
                    x: (index % 3) - 1,
                    y: 0.4,
                    z: Math.floor(index / 3) - 1,
                })),
            },
        }),
        [],
    );
    const handleFrame = useCallback(
        (nextPosition: { x: number; y: number; z: number }) => {
            setPosition(nextPosition);
        },
        [],
    );

    return (
        <GameStateContext.Provider value={gameState}>
            <div
                data-actor-x={position?.x ?? ''}
                data-actor-y={position?.y ?? ''}
                data-actor-z={position?.z ?? ''}
                data-opened={opened ? 'true' : 'false'}
                data-render-ready={position ? 'true' : 'false'}
                data-testid="detailed-inspection-farmer-fixture"
                style={{ height: 320, position: 'relative', width: 420 }}
            >
                <Scene
                    position={[4, 4, 4]}
                    quality={gameQualityProfiles.low}
                    suspendWhenOffscreen={false}
                    zoom={70}
                >
                    <ambientLight intensity={2.2} />
                    <directionalLight intensity={2.5} position={[3, 6, 2]} />
                    <mesh position={[0, 0.2, 0]} scale={[3, 0.4, 3]}>
                        <boxGeometry />
                        <meshStandardMaterial color="#88ad49" />
                    </mesh>
                    <Suspense fallback={null}>
                        <DetailedInspectionFarmer
                            id="inspection-fixture"
                            message="Pregledao sam gredice. Imam nekoliko bilješki za tebe..."
                            onOpen={() => setOpened(true)}
                            transform={transform}
                        />
                    </Suspense>
                    <DetailedInspectionFarmerObserver onFrame={handleFrame} />
                </Scene>
            </div>
        </GameStateContext.Provider>
    );
}
