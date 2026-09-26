import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { SceneTimeProvider } from '../src/scene/SceneTime';
import { Stars } from '../src/scene/Stars';
import {
    createGameState,
    GameStateContext,
    type GardenAvatarView,
} from '../src/useGameState';
import { StarsDepthProbe } from './StarsDepthProbe';

export function StarsDepthFixture({
    view,
    occluded = false,
}: {
    view: GardenAvatarView;
    occluded?: boolean;
}) {
    const store = useMemo(() => {
        const state = createGameState({
            appBaseUrl: '/',
            freezeTime: null,
            isMock: true,
        });
        state.setState({ gardenAvatarView: view });
        return state;
    }, [view]);
    return (
        <GameStateContext.Provider value={store}>
            <div style={{ width: 400, height: 400 }}>
                <Canvas
                    orthographic={view === 'overview'}
                    camera={{
                        position: [0, 0, 0],
                        zoom: view === 'overview' ? 12 : 1,
                        near: 0.01,
                        far: 1000,
                    }}
                    dpr={1}
                    gl={{ preserveDrawingBuffer: true, antialias: false }}
                >
                    <color attach="background" args={['black']} />
                    <SceneTimeProvider
                        fixedTimeSeconds={0}
                        baseFramesPerSecond={30}
                    >
                        <Stars />
                        <StarsDepthProbe />
                    </SceneTimeProvider>
                    {/* Farther than the stars' physical positions: depth testing
                        alone cannot keep them behind this opaque block. */}
                    <mesh position={[0, 0, -60]} visible={occluded}>
                        <boxGeometry args={[200, 200, 1]} />
                        <meshBasicMaterial color="black" />
                    </mesh>
                </Canvas>
            </div>
        </GameStateContext.Provider>
    );
}
