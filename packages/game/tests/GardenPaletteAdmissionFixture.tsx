import { StrictMode, useCallback, useState } from 'react';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { GardenPaletteAdmissionScene } from './GardenPaletteAdmissionScene';

export function GardenPaletteAdmissionFixture({
    batch = false,
    mutated = false,
    patched = false,
    mounted = true,
    aggregate = false,
    sources = 3,
}: {
    batch?: boolean;
    mutated?: boolean;
    patched?: boolean;
    mounted?: boolean;
    aggregate?: boolean;
    sources?: 1 | 3;
}) {
    const [store] = useState(() =>
        createGameState({
            appBaseUrl: 'http://localhost',
            isMock: true,
            freezeTime: new Date('2026-07-01T12:00:00Z'),
        }),
    );
    useDisposeGameStateStore(store);
    const [result, setResult] = useState<{
        key: string;
        [key: string]: unknown;
    }>();
    const report = useCallback(
        (value: { key: string; [key: string]: unknown }) => setResult(value),
        [],
    );
    const key = `${batch}:${mutated}:${patched}:${mounted}${aggregate ? `:aggregate:${sources}` : ''}`;
    return (
        <div
            data-testid="garden-palette-admission"
            data-ready={result?.key === key ? key : ''}
            data-result={JSON.stringify(result)}
            style={{ width: 512, height: 384 }}
        >
            <StrictMode>
                <GameStateContext.Provider value={store}>
                    <Scene
                        position={[0, 9, 15]}
                        zoom={27}
                        pixelRatio={1}
                        frameloop="always"
                        fixedTimeSeconds={43200}
                        baseFramesPerSecond={60}
                        adaptiveHighEnabled={false}
                        staticOpaqueCacheEnabled={false}
                        rendererOptions={{
                            alpha: false,
                            antialias: false,
                            preserveDrawingBuffer: true,
                        }}
                    >
                        <GardenPaletteAdmissionScene
                            aggregate={aggregate}
                            sources={sources}
                            batch={batch}
                            mutated={mutated}
                            patched={patched}
                            mounted={mounted}
                            onReadback={report}
                        />
                    </Scene>
                </GameStateContext.Provider>
            </StrictMode>
        </div>
    );
}
