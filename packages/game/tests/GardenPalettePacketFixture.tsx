import { Canvas } from '@react-three/fiber';
import { StrictMode, useCallback, useState } from 'react';
import { GardenPalettePacketScene } from './GardenPalettePacketScene';
import type {
    GardenPaletteFixtureReadback,
    GardenPaletteFixtureWeather,
} from './gardenPaletteFixtureData';

export function GardenPalettePacketFixture({
    palette = false,
    mutated = false,
    mounted = true,
    night = false,
    weather = 'clear',
}: {
    palette?: boolean;
    mutated?: boolean;
    mounted?: boolean;
    night?: boolean;
    weather?: GardenPaletteFixtureWeather;
}) {
    const [result, setResult] = useState<GardenPaletteFixtureReadback>();
    const report = useCallback(
        (value: GardenPaletteFixtureReadback) => setResult(value),
        [],
    );
    const key = `${palette}:${mutated}:${mounted}:${night}:${weather}`;
    return (
        <div
            data-testid="garden-palette-fixture"
            data-ready={result?.key === key ? key : ''}
            data-result={JSON.stringify(result)}
            style={{ width: 512, height: 384 }}
        >
            <StrictMode>
                <Canvas
                    orthographic
                    camera={{ position: [5, 5, 8], zoom: 55 }}
                    dpr={1}
                    shadows
                    frameloop="always"
                    gl={{
                        alpha: false,
                        antialias: false,
                        preserveDrawingBuffer: true,
                    }}
                >
                    <GardenPalettePacketScene
                        palette={palette}
                        mutated={mutated}
                        mounted={mounted}
                        night={night}
                        weather={weather}
                        onReadback={report}
                    />
                </Canvas>
            </StrictMode>
        </div>
    );
}
