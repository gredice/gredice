import { useCallback, useRef, useState } from 'react';
import { gameQualityProfiles } from '../../../packages/game/src/scene/gameQuality';
import { Scene } from '../../../packages/game/src/scene/Scene';
import { FaunaRuntimeProbe } from '../../../packages/game/tests/FaunaRuntimeProbe';

export function FaunaRuntimeFixture() {
    const first = useRef<HTMLDivElement>(null);
    const second = useRef<HTMLDivElement>(null);
    const reportFirst = useCallback((sample: string) => {
        if (first.current) first.current.dataset.sample = sample;
    }, []);
    const reportSecond = useCallback((sample: string) => {
        if (second.current) second.current.dataset.sample = sample;
    }, []);
    const [mounted, setMounted] = useState(false);
    const [generation, setGeneration] = useState(0);
    const [secondMounted, setSecondMounted] = useState(true);
    return (
        <div>
            <button type="button" onClick={() => setMounted((value) => !value)}>
                Toggle animal
            </button>
            <button
                type="button"
                onClick={() => setGeneration((value) => value + 1)}
            >
                Switch garden
            </button>
            <button
                type="button"
                onClick={() => setSecondMounted((value) => !value)}
            >
                Toggle second root
            </button>
            <div
                ref={first}
                data-testid="fauna-a"
                data-sample="{}"
                style={{ width: 256, height: 256 }}
            >
                <Scene
                    position={[0, 4, 8]}
                    zoom={30}
                    quality={gameQualityProfiles.medium}
                    pixelRatio={1}
                    staticOpaqueCacheEnabled={false}
                    adaptiveHighEnabled={false}
                >
                    {mounted ? (
                        <FaunaRuntimeProbe
                            key={generation}
                            id="a"
                            onSample={reportFirst}
                        />
                    ) : null}
                </Scene>
            </div>
            <div
                ref={second}
                data-testid="fauna-b"
                data-sample="{}"
                style={{
                    width: 256,
                    height: 256,
                    position: 'fixed',
                    left: 300,
                    top: 0,
                }}
            >
                {secondMounted ? (
                    <Scene
                        position={[0, 4, 8]}
                        zoom={30}
                        quality={gameQualityProfiles.medium}
                        pixelRatio={1}
                        staticOpaqueCacheEnabled={false}
                        adaptiveHighEnabled={false}
                    >
                        <FaunaRuntimeProbe id="b" onSample={reportSecond} />
                    </Scene>
                ) : null}
            </div>
        </div>
    );
}
