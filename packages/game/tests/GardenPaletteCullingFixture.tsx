import { StrictMode, useCallback, useState } from 'react';
import { gameQualityProfiles } from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import {
    type GardenPaletteCullingReadback,
    GardenPaletteCullingScene,
} from './GardenPaletteCullingScene';

export type GardenPaletteCullingView = 'mixed' | 'all' | 'none' | 'opposite';

export function GardenPaletteCullingFixture({
    batch = false,
    view = 'mixed',
    equalUniforms = false,
    unsupportedRange = false,
    legacyMerged = false,
    transitionWitness = false,
    shaderRevision = 0,
    restoreContext = false,
}: {
    batch?: boolean;
    view?: GardenPaletteCullingView;
    equalUniforms?: boolean;
    unsupportedRange?: boolean;
    legacyMerged?: boolean;
    transitionWitness?: boolean;
    shaderRevision?: number;
    restoreContext?: boolean;
}) {
    const [store] = useState(() =>
        createGameState({
            appBaseUrl: '',
            isMock: true,
            freezeTime: new Date('2026-07-01T12:00:00Z'),
        }),
    );
    useDisposeGameStateStore(store);
    const [result, setResult] = useState<GardenPaletteCullingReadback>();
    const report = useCallback(
        (next: GardenPaletteCullingReadback) => setResult(next),
        [],
    );
    const key = `${batch}:${view}${equalUniforms ? ':equal' : ''}${unsupportedRange ? ':legacy-range' : ''}${legacyMerged ? ':legacy-merged' : ''}${transitionWitness ? `:transition:${shaderRevision}:${restoreContext}` : ''}`;
    return (
        <div
            data-testid="palette-culling"
            data-ready={result?.key === key ? key : ''}
            data-result={JSON.stringify(result)}
            style={{ width: 512, height: 384 }}
        >
            <StrictMode>
                <GameStateContext.Provider value={store}>
                    <Scene
                        position={[0, 0, 8]}
                        zoom={100}
                        pixelRatio={1}
                        quality={gameQualityProfiles.high}
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
                        <GardenPaletteCullingScene
                            batch={batch}
                            view={view}
                            equalUniforms={equalUniforms}
                            unsupportedRange={unsupportedRange}
                            legacyMerged={legacyMerged}
                            transitionWitness={transitionWitness}
                            shaderRevision={shaderRevision}
                            restoreContext={restoreContext}
                            onReadback={report}
                        />
                    </Scene>
                </GameStateContext.Provider>
            </StrictMode>
        </div>
    );
}
