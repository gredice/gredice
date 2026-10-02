import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Mesh } from 'three';
import { readSharedGardenMaterialMetrics } from '../src/scene/gardenMaterials';
import { GardenPaletteFixtureMesh } from './GardenPaletteFixtureMesh';
import {
    createGardenPaletteFixtureSources,
    type GardenPaletteFixtureReadback,
    type GardenPaletteFixtureWeather,
} from './gardenPaletteFixtureData';

export function GardenPalettePacketScene({
    palette,
    fallback,
    mutated,
    mounted,
    night,
    weather,
    onReadback,
}: {
    palette: boolean;
    fallback: boolean;
    mutated: boolean;
    mounted: boolean;
    night: boolean;
    weather: GardenPaletteFixtureWeather;
    onReadback: (result: GardenPaletteFixtureReadback) => void;
}) {
    const scene = useThree((state) => state.scene);
    const sources = useMemo(createGardenPaletteFixtureSources, []);
    const frames = useRef({ key: '', count: 0 });
    const key = `${fallback ? 'fallback:' : ''}${palette}:${mutated}:${mounted}:${night}:${weather}`;
    useLayoutEffect(
        () => () => {
            for (const source of sources.sources) {
                source.geometry.dispose();
                source.material.dispose();
            }
            sources.texture.dispose();
            sources.masks.dispose();
        },
        [sources],
    );
    useFrame(() => {
        if (frames.current.key !== key) frames.current = { key, count: 0 };
        frames.current.count++;
        if (frames.current.count !== 8) return;
        const materials = new Set();
        let meshes = 0;
        let paletteVertices = 0;
        scene.traverse((object) => {
            if (
                !(object instanceof Mesh) ||
                !object.name.startsWith('GardenPaletteFixture:')
            )
                return;
            meshes++;
            materials.add(object.material);
            paletteVertices +=
                object.geometry.getAttribute('aGardenPalette0')?.count ?? 0;
        });
        const metrics = readSharedGardenMaterialMetrics();
        onReadback({
            key,
            materials: materials.size,
            meshes,
            paletteVertices,
            paletteMaterials: metrics.canonicalMaterials,
            sharedMaterialUsers: metrics.sharedMaterialUsers,
        });
    });
    return (
        <>
            <color attach="background" args={['#18222d']} />
            <ambientLight intensity={night ? 0.15 : 0.4} />
            <directionalLight
                position={[3, 6, 4]}
                intensity={night ? 0.45 : 3}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-5}
                shadow-camera-right={5}
                shadow-camera-top={5}
                shadow-camera-bottom={-5}
                shadow-normalBias={0.015}
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[12, 12]} />
                <meshStandardMaterial color="#807767" roughness={1} />
            </mesh>
            {/* Foreground occluder exercises depth with the cutout behind it. */}
            <mesh position={[-2.4, 0.4, 2]} castShadow receiveShadow>
                <boxGeometry args={[0.4, 0.8, 0.4]} />
                <meshStandardMaterial color="#f1f1f1" />
            </mesh>
            {mounted &&
                sources.sources.map((source) => (
                    <GardenPaletteFixtureMesh
                        key={source.name}
                        source={source}
                        palette={palette}
                        fallback={fallback}
                        mutated={mutated}
                        weather={weather}
                    />
                ))}
        </>
    );
}
