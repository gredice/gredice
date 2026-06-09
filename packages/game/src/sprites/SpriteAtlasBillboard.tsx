'use client';

import { Billboard } from '@react-three/drei';
import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import type { IUniform, Texture } from 'three';
import { Color, PlaneGeometry, Vector4 } from 'three';
import { SeededRNG } from '../generators/plant/lib/rng';
import { useSceneTimeUniform } from '../scene/SceneTime';
import { useGameState } from '../useGameState';
import { resolveSpriteAtlasAssetPaths } from './resolveSpriteAtlasAssetPaths';
import { getSpriteBrightness } from './spriteLighting';
import type { SpriteAtlasPage } from './types';
import { useSpriteAtlasManifest } from './useSpriteAtlasManifest';
import { useSpriteAtlasTexture } from './useSpriteAtlasTexture';

type SpriteAtlasBillboardProps = {
    alphaTest?: number;
    atlasBasePath: string;
    depthWrite?: boolean;
    debugName?: string;
    follow?: boolean;
    height?: number;
    opacity?: number;
    position?: [number, number, number];
    renderOrder?: number;
    rotationZ?: number;
    spriteName: string;
    windDirection?: number;
    windSpeed?: number;
};

type WobbleAnimation = {
    crossPrimaryFrequency: number;
    crossSecondaryFrequency: number;
    directionX: number;
    directionZ: number;
    directionalPrimaryFrequency: number;
    directionalSecondaryFrequency: number;
    gustFrequency: number;
    gustScale: number;
    phase: number;
    secondaryPhase: number;
    wobbleAmplitude: number;
};

type BillboardMeshProps = {
    alphaTest: number;
    color: Color;
    debugName: string;
    depthWrite: boolean;
    geometry: PlaneGeometry;
    opacity: number;
    renderOrder?: number;
    rotationZ: number;
    texture: Texture;
};

type AnimatedBillboardMeshProps = BillboardMeshProps & {
    wobbleAnimation: WobbleAnimation;
};

type SpriteWobbleShaderUniforms = {
    uSpriteWobbleDirections: IUniform<Vector4>;
    uSpriteWobbleFrequencies: IUniform<Vector4>;
    uSpriteWobbleParams: IUniform<Vector4>;
    uTime: IUniform<number>;
};

type SpriteWobbleShader = {
    uniforms: Record<string, IUniform<unknown>>;
    vertexShader: string;
};

function resolvePageBasePath(atlasBasePath: string, pageIndex: number) {
    return pageIndex === 0 ? atlasBasePath : `${atlasBasePath}.${pageIndex}`;
}

function createSpriteWobbleShaderUniforms(
    timeUniform: IUniform<number>,
): SpriteWobbleShaderUniforms {
    return {
        uSpriteWobbleDirections: {
            value: new Vector4(),
        },
        uSpriteWobbleFrequencies: {
            value: new Vector4(),
        },
        uSpriteWobbleParams: {
            value: new Vector4(),
        },
        uTime: timeUniform,
    };
}

function updateSpriteWobbleShaderUniforms(
    uniforms: SpriteWobbleShaderUniforms,
    wobbleAnimation: WobbleAnimation,
) {
    uniforms.uSpriteWobbleDirections.value.set(
        wobbleAnimation.directionX,
        wobbleAnimation.directionZ,
        wobbleAnimation.wobbleAmplitude,
        wobbleAnimation.gustScale,
    );
    uniforms.uSpriteWobbleFrequencies.value.set(
        wobbleAnimation.directionalPrimaryFrequency,
        wobbleAnimation.directionalSecondaryFrequency,
        wobbleAnimation.crossPrimaryFrequency,
        wobbleAnimation.crossSecondaryFrequency,
    );
    uniforms.uSpriteWobbleParams.value.set(
        wobbleAnimation.gustFrequency,
        wobbleAnimation.phase,
        wobbleAnimation.secondaryPhase,
        0,
    );
}

function applySpriteWobbleShader(
    shader: SpriteWobbleShader,
    uniforms: SpriteWobbleShaderUniforms,
) {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSpriteWobbleDirections = uniforms.uSpriteWobbleDirections;
    shader.uniforms.uSpriteWobbleFrequencies =
        uniforms.uSpriteWobbleFrequencies;
    shader.uniforms.uSpriteWobbleParams = uniforms.uSpriteWobbleParams;
    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
#include <common>
uniform float uTime;
uniform vec4 uSpriteWobbleDirections;
uniform vec4 uSpriteWobbleFrequencies;
uniform vec4 uSpriteWobbleParams;

mat3 spriteWobbleRotationX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

mat3 spriteWobbleRotationZ(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
    );
}
`,
    );
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
#include <begin_vertex>
float directionalWave =
    sin(uTime * uSpriteWobbleFrequencies.x + uSpriteWobbleParams.y) * 0.9 +
    cos(uTime * uSpriteWobbleFrequencies.y + uSpriteWobbleParams.z) * 0.35 +
    sin(uTime * uSpriteWobbleParams.x + uSpriteWobbleParams.y * 0.5) *
        uSpriteWobbleDirections.w;
float crossWave =
    sin(uTime * uSpriteWobbleFrequencies.z + uSpriteWobbleParams.z * 0.7) *
        0.75 +
    cos(uTime * uSpriteWobbleFrequencies.w + uSpriteWobbleParams.y) * 0.3;
float spriteRotationX =
    uSpriteWobbleDirections.y * directionalWave *
        uSpriteWobbleDirections.z +
    uSpriteWobbleDirections.x * crossWave *
        uSpriteWobbleDirections.z * 0.55;
float spriteRotationZ =
    -uSpriteWobbleDirections.x * directionalWave *
        uSpriteWobbleDirections.z +
    uSpriteWobbleDirections.y * crossWave *
        uSpriteWobbleDirections.z * 0.55;
transformed =
    spriteWobbleRotationZ(spriteRotationZ) *
    spriteWobbleRotationX(spriteRotationX) *
    transformed;
`,
    );
}

export function SpriteAtlasBillboard({
    alphaTest = 0.05,
    atlasBasePath,
    debugName,
    depthWrite = false,
    follow = true,
    height = 1,
    opacity = 1,
    position = [0, 0, 0],
    renderOrder,
    rotationZ = 0,
    spriteName,
    windDirection = 0,
    windSpeed = 0,
}: SpriteAtlasBillboardProps) {
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const weather = useGameState((state) => state.weather);
    const assetPaths = useMemo(
        () => resolveSpriteAtlasAssetPaths(atlasBasePath),
        [atlasBasePath],
    );
    const resolvedDebugName =
        debugName ?? `SpriteAtlasBillboard:${atlasBasePath}:${spriteName}`;
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
        } satisfies WobbleAnimation;
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
        <Billboard
            follow={follow}
            name={`${resolvedDebugName}:billboard`}
            position={position}
        >
            <SpriteAtlasBillboardMesh
                alphaTest={alphaTest}
                color={color}
                debugName={resolvedDebugName}
                depthWrite={depthWrite}
                geometry={geometry}
                opacity={opacity}
                renderOrder={renderOrder}
                rotationZ={rotationZ}
                texture={texture}
                wobbleAnimation={wobbleAnimation}
            />
        </Billboard>
    );
}

function SpriteAtlasBillboardMesh({
    wobbleAnimation,
    ...props
}: BillboardMeshProps & { wobbleAnimation: WobbleAnimation | null }) {
    if (wobbleAnimation) {
        return (
            <AnimatedSpriteAtlasBillboardMesh
                {...props}
                wobbleAnimation={wobbleAnimation}
            />
        );
    }

    return <StaticSpriteAtlasBillboardMesh {...props} />;
}

function StaticSpriteAtlasBillboardMesh({
    alphaTest,
    color,
    debugName,
    depthWrite,
    geometry,
    opacity,
    renderOrder,
    rotationZ,
    texture,
}: BillboardMeshProps) {
    return (
        <mesh
            name={`${debugName}:mesh`}
            renderOrder={renderOrder}
            receiveShadow
            rotation={[0, 0, rotationZ]}
        >
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
    );
}

function AnimatedSpriteAtlasBillboardMesh({
    alphaTest,
    color,
    debugName,
    depthWrite,
    geometry,
    opacity,
    renderOrder,
    rotationZ,
    texture,
    wobbleAnimation,
}: AnimatedBillboardMeshProps) {
    const timeUniform = useSceneTimeUniform();
    const wobbleUniforms = useMemo(
        () => createSpriteWobbleShaderUniforms(timeUniform),
        [timeUniform],
    );
    useLayoutEffect(() => {
        updateSpriteWobbleShaderUniforms(wobbleUniforms, wobbleAnimation);
    }, [wobbleAnimation, wobbleUniforms]);
    const handleBeforeCompile = useCallback(
        (shader: SpriteWobbleShader) => {
            applySpriteWobbleShader(shader, wobbleUniforms);
        },
        [wobbleUniforms],
    );

    return (
        <mesh
            name={`${debugName}:animatedMesh`}
            renderOrder={renderOrder}
            receiveShadow
            rotation={[0, 0, rotationZ]}
        >
            <primitive attach="geometry" object={geometry} />
            <meshLambertMaterial
                alphaTest={alphaTest}
                color={color}
                depthWrite={depthWrite}
                map={texture}
                onBeforeCompile={handleBeforeCompile}
                opacity={opacity}
                transparent
            />
        </mesh>
    );
}
