import { useLayoutEffect, useMemo, useState } from 'react';
import { Matrix4 } from 'three';
import {
    compileMeshBuffers,
    packMeshGeometry,
    unpackMeshGeometry,
} from '../src/scene/compiler/meshBuffers';
import { useGardenPalettePacketSource } from '../src/scene/gardenPaletteMaterials';
import { createWeatherSurfaceGeometry } from '../src/scene/weatherSurfaceGeometry';
import { createIntegratedWeatherSurfaceMaterial } from '../src/scene/weatherSurfaceMaterial';
import type {
    GardenPaletteFixtureSource,
    GardenPaletteFixtureWeather,
} from './gardenPaletteFixtureData';

export function GardenPaletteFixtureMesh({
    source,
    palette,
    mutated,
    weather,
}: {
    source: GardenPaletteFixtureSource;
    palette: boolean;
    mutated: boolean;
    weather: GardenPaletteFixtureWeather;
}) {
    const [revision, setRevision] = useState(0);
    useLayoutEffect(() => {
        if (source.name !== 'rough') return;
        source.material.color.set(mutated ? '#55c88a' : '#c58743');
        source.material.roughness = mutated ? 0.25 : 0.9;
        setRevision((value) => value + 1);
    }, [mutated, source]);
    const integrated = useMemo(() => {
        if (!source.weather || weather === 'clear') return undefined;
        source.geometry.computeBoundingBox();
        const bounds = source.geometry.boundingBox;
        if (!bounds) throw new Error('Palette fixture geometry has no bounds.');
        return createIntegratedWeatherSurfaceMaterial(source.material, {
            frostIntensityUniform: { value: weather === 'rain' ? 0.2 : 0 },
            rain: {
                bounds: {
                    min: [bounds.min.x, bounds.min.y, bounds.min.z],
                    max: [bounds.max.x, bounds.max.y, bounds.max.z],
                },
                enabled: weather === 'rain' || weather === 'combined',
                darkness: 1,
                glossiness: 0.7,
                puddleStrengthUniform: { value: 0.3 },
                topSurfaceBias: 1.8,
                wetnessUniform: { value: 0.65 },
            },
            snow: {
                enabled: weather === 'snow' || weather === 'combined',
                amountUniform: { value: 0.6 },
                color: '#f7f7ff',
                lift: 0.003,
                maxThickness: 0.18,
                noiseAmplitude: 0.35,
                noiseInfluence: 0.15,
                noiseScale: 2.5,
                slopeExponent: 2.4,
            },
        });
    }, [source, weather]);
    const weatherGeometry = useMemo(
        () =>
            source.weather && (weather === 'snow' || weather === 'combined')
                ? createWeatherSurfaceGeometry(source.geometry, {
                      includeSnowSkirts: true,
                  })
                : source.geometry,
        [source, weather],
    );
    const prepared = useGardenPalettePacketSource(
        weatherGeometry,
        integrated ?? source.material,
        palette,
    );
    const compiled = useMemo(() => {
        // Use identical compiler transforms on both sides to isolate shader
        // parity from Float32 model-matrix rounding in procedural world noise.
        const matrix = new Matrix4().makeTranslation(
            source.position[0],
            source.position[1],
            source.position[2],
        );
        return unpackMeshGeometry(
            compileMeshBuffers(
                packMeshGeometry(prepared.geometry),
                new Float64Array(matrix.elements),
            ),
        );
    }, [prepared.geometry, source]);
    useLayoutEffect(() => () => integrated?.dispose(), [integrated]);
    useLayoutEffect(() => () => compiled?.dispose(), [compiled]);
    useLayoutEffect(
        () => () => {
            if (weatherGeometry !== source.geometry) weatherGeometry.dispose();
        },
        [source.geometry, weatherGeometry],
    );
    return (
        <mesh
            name={`GardenPaletteFixture:${source.name}:revision:${revision}`}
            castShadow
            receiveShadow
            geometry={compiled}
            material={prepared.material}
        />
    );
}
