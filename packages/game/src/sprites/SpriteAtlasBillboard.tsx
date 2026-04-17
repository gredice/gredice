'use client';

import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Color, DoubleSide, PlaneGeometry } from 'three';
import { SeededRNG } from '../generators/plant/lib/rng';
import { useGameState } from '../useGameState';
import { resolveSpriteAtlasAssetPaths } from './resolveSpriteAtlasAssetPaths';
import type { SpriteAtlasPage } from './types';
import { useSpriteAtlasManifest } from './useSpriteAtlasManifest';
import { useSpriteAtlasTexture } from './useSpriteAtlasTexture';

type SpriteAtlasBillboardProps = {
    alphaTest?: number;
    atlasBasePath: string;
    depthWrite?: boolean;
    follow?: boolean;
    height?: number;
    opacity?: number;
    position?: [number, number, number];
    renderOrder?: number;
    spriteName: string;
    windDirection?: number;
    windSpeed?: number;
};

function resolvePageBasePath(atlasBasePath: string, pageIndex: number) {
    return pageIndex === 0 ? atlasBasePath : `${atlasBasePath}.${pageIndex}`;
}

function getSunlightFactor(timeOfDay: number) {
    if (timeOfDay <= 0.2 || timeOfDay >= 0.81) {
        return 0;
    }

    if (timeOfDay < 0.225) {
        return (timeOfDay - 0.2) / 0.025;
    }

    if (timeOfDay <= 0.75) {
        return 1;
    }

    return 1 - (timeOfDay - 0.75) / 0.06;
}

function getSpriteBrightness(
    timeOfDay: number,
    weather:
        | {
              cloudy: number;
              foggy: number;
              rainy: number;
          }
        | undefined,
) {
    const daylightFactor = getSunlightFactor(timeOfDay);
    const cloudy = weather?.cloudy ?? 0;
    const foggy = weather?.foggy ?? 0;
    const rainy = weather?.rainy ?? 0;
    const weatherShade = Math.min(
        0.35,
        cloudy * 0.18 + foggy * 0.22 + rainy * 0.08,
    );
    const baseBrightness = 0.28 + daylightFactor * 0.42;

    return Math.max(0.3, baseBrightness * (1 - weatherShade));
}

export function SpriteAtlasBillboard({
    alphaTest = 0.05,
    atlasBasePath,
    depthWrite = false,
    follow = true,
    height = 1,
    opacity = 1,
    position = [0, 0, 0],
    renderOrder,
    spriteName,
    windDirection = 0,
    windSpeed = 0,
}: SpriteAtlasBillboardProps) {
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const weather = useGameState((state) => state.weather);
    const meshRef = useRef<Mesh | null>(null);
    const assetPaths = useMemo(
        () => resolveSpriteAtlasAssetPaths(atlasBasePath),
        [atlasBasePath],
    );
    const brightness = getSpriteBrightness(timeOfDay, weather);
    const color = useMemo(() => {
        return new Color().setScalar(brightness);
    }, [brightness]);
    const wobbleProfile = useMemo(() => {
        const positionKey = position.map((value) => value.toFixed(3)).join(':');
        const rng = new SeededRNG(
            `${atlasBasePath}:${spriteName}:${positionKey}`,
        );

        return {
            amplitude: rng.nextRange(1.15, 1.75),
            gust: rng.nextRange(0.7, 1.25),
            phase: rng.nextRange(0, Math.PI * 2),
            secondaryPhase: rng.nextRange(0, Math.PI * 2),
            speed: rng.nextRange(0.9, 1.35),
        };
    }, [atlasBasePath, position, spriteName]);
    const wobbleAnimation = useMemo(() => {
        const windStrength = Math.max(0, Math.min(1, windSpeed / 16));
        if (windStrength <= 0.001) {
            return null;
        }

        const windDirectionRadians = (windDirection * Math.PI) / 180;

        return {
            crossPrimaryFrequency: 1.1 + windStrength * 0.6,
            crossSecondaryFrequency: 0.58 + windStrength * 0.4,
            directionX: Math.sin(windDirectionRadians),
            directionZ: -Math.cos(windDirectionRadians),
            directionalPrimaryFrequency:
                (1.35 + windStrength * 1.45) * wobbleProfile.speed,
            directionalSecondaryFrequency:
                (1 + windStrength * 0.9) * (2 - wobbleProfile.speed),
            gustFrequency: 0.6 + windStrength * 0.8,
            gustScale: wobbleProfile.gust * windStrength * 0.7,
            phase: wobbleProfile.phase,
            secondaryPhase: wobbleProfile.secondaryPhase,
            wobbleAmplitude:
                (0.035 + windStrength * 0.2) * wobbleProfile.amplitude,
        };
    }, [windDirection, windSpeed, wobbleProfile]);
    const { error: manifestError, manifest } = useSpriteAtlasManifest(
        assetPaths.manifestUrl,
    );
    const sprite = manifest?.sprites[spriteName];
    const atlasPage = useMemo(() => {
        if (!manifest || !sprite) {
            return null;
        }

        if (manifest.pages && manifest.pages.length > 0) {
            const spritePageIndex = sprite.page ?? 0;
            return (
                manifest.pages.find((page) => page.index === spritePageIndex) ??
                manifest.pages[spritePageIndex] ??
                null
            );
        }

        if (!manifest.atlas) {
            return null;
        }

        return {
            atlas: manifest.atlas,
            index: 0,
            spriteCount: Object.keys(manifest.sprites).length,
        } satisfies SpriteAtlasPage;
    }, [manifest, sprite]);
    const pageAssetPaths = useMemo(
        () =>
            atlasPage
                ? resolveSpriteAtlasAssetPaths(
                      resolvePageBasePath(atlasBasePath, atlasPage.index),
                  )
                : null,
        [atlasBasePath, atlasPage],
    );
    const { error: textureError, texture } =
        useSpriteAtlasTexture(pageAssetPaths);

    const geometry = useMemo(() => {
        if (!atlasPage || !sprite) {
            return null;
        }

        const atlas = atlasPage.atlas;
        const planeGeometry = new PlaneGeometry(height * sprite.aspect, height);
        planeGeometry.translate(0, height / 2, 0);
        const u0 = sprite.frame.x / atlas.width;
        const u1 = (sprite.frame.x + sprite.frame.width) / atlas.width;
        const v0 = 1 - (sprite.frame.y + sprite.frame.height) / atlas.height;
        const v1 = 1 - sprite.frame.y / atlas.height;
        const uv = planeGeometry.getAttribute('uv');

        uv.setXY(0, u0, v1);
        uv.setXY(1, u1, v1);
        uv.setXY(2, u0, v0);
        uv.setXY(3, u1, v0);
        uv.needsUpdate = true;

        return planeGeometry;
    }, [atlasPage, height, sprite]);

    useEffect(() => {
        return () => {
            geometry?.dispose();
        };
    }, [geometry]);

    useFrame(({ clock }) => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        if (!wobbleAnimation) {
            mesh.rotation.x = 0;
            mesh.rotation.z = 0;
            return;
        }

        const time = clock.getElapsedTime();
        const directionalWave =
            Math.sin(
                time * wobbleAnimation.directionalPrimaryFrequency +
                    wobbleAnimation.phase,
            ) *
                0.9 +
            Math.cos(
                time * wobbleAnimation.directionalSecondaryFrequency +
                    wobbleAnimation.secondaryPhase,
            ) *
                0.35 +
            Math.sin(
                time * wobbleAnimation.gustFrequency +
                    wobbleAnimation.phase * 0.5,
            ) *
                wobbleAnimation.gustScale;
        const crossWave =
            Math.sin(
                time * wobbleAnimation.crossPrimaryFrequency +
                    wobbleAnimation.secondaryPhase * 0.7,
            ) *
                0.75 +
            Math.cos(
                time * wobbleAnimation.crossSecondaryFrequency +
                    wobbleAnimation.phase,
            ) *
                0.3;

        mesh.rotation.x =
            wobbleAnimation.directionZ *
                directionalWave *
                wobbleAnimation.wobbleAmplitude +
            wobbleAnimation.directionX *
                crossWave *
                wobbleAnimation.wobbleAmplitude *
                0.55;
        mesh.rotation.z =
            -wobbleAnimation.directionX *
                directionalWave *
                wobbleAnimation.wobbleAmplitude +
            wobbleAnimation.directionZ *
                crossWave *
                wobbleAnimation.wobbleAmplitude *
                0.55;
    });

    if (manifestError) {
        console.error(
            `Failed to load sprite atlas manifest "${atlasBasePath}":`,
            manifestError,
        );

        return null;
    }

    if (textureError) {
        console.error(
            `Failed to load sprite atlas texture "${atlasBasePath}":`,
            textureError,
        );
        return null;
    }

    if (!manifest) {
        return null;
    }

    if (!sprite) {
        console.warn(
            `Sprite "${spriteName}" was not found in atlas "${atlasBasePath}".`,
        );
        return null;
    }

    if (!texture || !geometry) {
        return null;
    }

    return (
        <Billboard follow={follow} position={position}>
            <mesh ref={meshRef} renderOrder={renderOrder} receiveShadow>
                <primitive attach="geometry" object={geometry} />
                <meshLambertMaterial
                    alphaTest={alphaTest}
                    color={color}
                    depthWrite={depthWrite}
                    map={texture}
                    opacity={opacity}
                    transparent
                />
            </mesh>
        </Billboard>
    );
}
