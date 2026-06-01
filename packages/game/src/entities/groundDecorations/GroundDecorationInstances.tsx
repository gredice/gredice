'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
    Euler,
    InstancedBufferAttribute,
    type InstancedMesh,
    Matrix4,
    MeshLambertMaterial,
    PlaneGeometry,
    Quaternion,
    Vector3,
} from 'three';
import { SeededRNG } from '../../generators/plant/lib/rng';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import { resolveSpriteAtlasAssetPaths } from '../../sprites/resolveSpriteAtlasAssetPaths';
import { getSpriteBrightness } from '../../sprites/spriteLighting';
import type { SpriteAtlasPage, SpriteAtlasSprite } from '../../sprites/types';
import { useSpriteAtlasManifest } from '../../sprites/useSpriteAtlasManifest';
import { useSpriteAtlasTexture } from '../../sprites/useSpriteAtlasTexture';
import { useGameState } from '../../useGameState';
import { groundDecorationAtlasBasePath } from './groundDecorationConfig';

export type GroundDecorationInstance = {
    alphaTest: number;
    height: number;
    opacity: number;
    position: [number, number, number];
    rotationZ: number;
    spriteName: string;
};

type GroundDecorationBatch = {
    alphaTest: number;
    instances: GroundDecorationInstance[];
    opacity: number;
    sprite: SpriteAtlasSprite;
    spriteName: string;
};

type GroundDecorationShaderUniforms = Record<string, { value: unknown }> & {
    uTime?: { value: number };
    uWindDirection?: { value: Vector3 };
    uWindStrength?: { value: number };
};

const compassToDirection: Record<string, number> = {
    E: 90,
    N: 0,
    NE: 45,
    NW: 315,
    S: 180,
    SE: 135,
    SW: 225,
    W: 270,
};

function resolvePageBasePath(atlasBasePath: string, pageIndex: number) {
    return pageIndex === 0 ? atlasBasePath : `${atlasBasePath}.${pageIndex}`;
}

function resolveAtlasPage(
    pages: SpriteAtlasPage[] | undefined,
    pageIndex: number,
    atlas: SpriteAtlasPage['atlas'] | undefined,
) {
    if (pages && pages.length > 0) {
        return (
            pages.find((page) => page.index === pageIndex) ??
            pages[pageIndex] ??
            null
        );
    }

    return atlas
        ? ({
              atlas,
              index: 0,
              spriteCount: 0,
          } satisfies SpriteAtlasPage)
        : null;
}

function createSpriteGeometry(
    sprite: SpriteAtlasSprite,
    page: SpriteAtlasPage,
) {
    const geometry = new PlaneGeometry(1, 1);
    geometry.translate(0, 0.5, 0);
    const atlas = page.atlas;
    const u0 = sprite.frame.x / atlas.width;
    const u1 = (sprite.frame.x + sprite.frame.width) / atlas.width;
    const v0 = 1 - (sprite.frame.y + sprite.frame.height) / atlas.height;
    const v1 = 1 - sprite.frame.y / atlas.height;
    const uv = geometry.getAttribute('uv');

    uv.setXY(0, u0, v1);
    uv.setXY(1, u1, v1);
    uv.setXY(2, u0, v0);
    uv.setXY(3, u1, v0);
    uv.needsUpdate = true;

    return geometry;
}

function addWobbleAttributes(
    geometry: PlaneGeometry,
    atlasPage: SpriteAtlasPage,
    batch: GroundDecorationBatch,
) {
    const wobbleAttributes = new Float32Array(batch.instances.length * 4);

    batch.instances.forEach((instance, index) => {
        const positionKey = instance.position
            .map((value) => value.toFixed(3))
            .join(':');
        const rng = new SeededRNG(
            `${groundDecorationAtlasBasePath}:${atlasPage.index}:${batch.spriteName}:${positionKey}`,
        );
        const windProfileOffset = index * 4;

        wobbleAttributes[windProfileOffset] = rng.nextRange(1.15, 1.75);
        wobbleAttributes[windProfileOffset + 1] = rng.nextRange(0.7, 1.25);
        wobbleAttributes[windProfileOffset + 2] = rng.nextRange(0, Math.PI * 2);
        wobbleAttributes[windProfileOffset + 3] = rng.nextRange(0.9, 1.35);
    });

    geometry.setAttribute(
        'instanceWobble',
        new InstancedBufferAttribute(wobbleAttributes, 4),
    );
}

function applyGroundDecorationWobbleShader(material: MeshLambertMaterial) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uWindDirection = { value: new Vector3(0, 0, -1) };
        shader.uniforms.uWindStrength = { value: 0 };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
#include <common>
attribute vec4 instanceWobble;
uniform float uTime;
uniform vec3 uWindDirection;
uniform float uWindStrength;
`,
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
#include <begin_vertex>
float windInfluence = clamp(position.y, 0.0, 1.0) * uWindStrength;
float directionalWave =
    sin(uTime * (1.35 + uWindStrength * 1.45) * instanceWobble.w + instanceWobble.z) * 0.9 +
    cos(uTime * (1.0 + uWindStrength * 0.9) * (2.0 - instanceWobble.w) + instanceWobble.z * 1.7) * 0.35 +
    sin(uTime * (0.6 + uWindStrength * 0.8) + instanceWobble.z * 0.5) * instanceWobble.y * uWindStrength * 0.7;
float crossWave =
    sin(uTime * (1.1 + uWindStrength * 0.6) + instanceWobble.z * 0.7) * 0.75 +
    cos(uTime * (0.58 + uWindStrength * 0.4) + instanceWobble.z) * 0.3;
float wobbleAmplitude = (0.035 + uWindStrength * 0.2) * instanceWobble.x;
vec2 crossDirection = vec2(-uWindDirection.z, uWindDirection.x);
transformed.xz += (
    uWindDirection.xz * directionalWave +
    crossDirection * crossWave * 0.55
) * wobbleAmplitude * windInfluence;
`,
        );
        material.userData.groundDecorationShader = shader;
    };
    material.customProgramCacheKey = () => 'ground-decoration-wobble-v1';
}

function buildBatchKey(instance: GroundDecorationInstance) {
    return `${instance.spriteName}:${instance.alphaTest}:${instance.opacity.toFixed(2)}`;
}

export function GroundDecorationInstances({
    instances,
}: {
    instances: GroundDecorationInstance[];
}) {
    const assetPaths = useMemo(
        () => resolveSpriteAtlasAssetPaths(groundDecorationAtlasBasePath),
        [],
    );
    const { error: manifestError, manifest } = useSpriteAtlasManifest(
        assetPaths.manifestUrl,
    );

    const instancesByPage = useMemo(() => {
        const byPage = new Map<number, GroundDecorationInstance[]>();
        if (!manifest) {
            return byPage;
        }

        for (const instance of instances) {
            const sprite = manifest.sprites[instance.spriteName];
            if (!sprite) {
                continue;
            }
            const pageIndex = sprite.page ?? 0;
            const pageInstances = byPage.get(pageIndex);
            if (pageInstances) {
                pageInstances.push(instance);
                continue;
            }
            byPage.set(pageIndex, [instance]);
        }

        return byPage;
    }, [instances, manifest]);

    if (manifestError) {
        console.error(
            `Failed to load sprite atlas manifest "${groundDecorationAtlasBasePath}":`,
            manifestError,
        );
        return null;
    }

    if (!manifest || instances.length === 0) {
        return null;
    }

    return (
        <>
            {[...instancesByPage.entries()].map(
                ([pageIndex, pageInstances]) => {
                    const page = resolveAtlasPage(
                        manifest.pages,
                        pageIndex,
                        manifest.atlas,
                    );

                    if (!page) {
                        return null;
                    }

                    return (
                        <GroundDecorationPageInstances
                            key={pageIndex}
                            atlasPage={page}
                            instances={pageInstances}
                            manifestSprites={manifest.sprites}
                        />
                    );
                },
            )}
        </>
    );
}

function GroundDecorationPageInstances({
    atlasPage,
    instances,
    manifestSprites,
}: {
    atlasPage: SpriteAtlasPage;
    instances: GroundDecorationInstance[];
    manifestSprites: Record<string, SpriteAtlasSprite>;
}) {
    const pageAssetPaths = useMemo(
        () =>
            resolveSpriteAtlasAssetPaths(
                resolvePageBasePath(
                    groundDecorationAtlasBasePath,
                    atlasPage.index,
                ),
            ),
        [atlasPage.index],
    );
    const { error: textureError, texture } =
        useSpriteAtlasTexture(pageAssetPaths);
    const batches = useMemo(() => {
        const batchByKey = new Map<string, GroundDecorationBatch>();

        for (const instance of instances) {
            const sprite = manifestSprites[instance.spriteName];
            if (!sprite) {
                continue;
            }

            const key = buildBatchKey(instance);
            const batch = batchByKey.get(key);
            if (batch) {
                batch.instances.push(instance);
                continue;
            }

            batchByKey.set(key, {
                alphaTest: instance.alphaTest,
                instances: [instance],
                opacity: instance.opacity,
                sprite,
                spriteName: instance.spriteName,
            });
        }

        return [...batchByKey.values()];
    }, [instances, manifestSprites]);

    if (textureError) {
        console.error(
            `Failed to load sprite atlas texture "${groundDecorationAtlasBasePath}":`,
            textureError,
        );
        return null;
    }

    if (!texture) {
        return null;
    }

    return (
        <>
            {batches.map((batch) => (
                <GroundDecorationInstancedBatch
                    key={`${batch.spriteName}:${batch.alphaTest}:${batch.opacity}`}
                    atlasPage={atlasPage}
                    batch={batch}
                    texture={texture}
                />
            ))}
        </>
    );
}

function GroundDecorationInstancedBatch({
    atlasPage,
    batch,
    texture,
}: {
    atlasPage: SpriteAtlasPage;
    batch: GroundDecorationBatch;
    texture: NonNullable<ReturnType<typeof useSpriteAtlasTexture>['texture']>;
}) {
    const meshRef = useRef<InstancedMesh | null>(null);
    const previousCameraQuaternion = useRef(new Quaternion(0, 0, 0, 0));
    const matrix = useMemo(() => new Matrix4(), []);
    const position = useMemo(() => new Vector3(), []);
    const quaternion = useMemo(() => new Quaternion(), []);
    const rotationZ = useMemo(() => new Quaternion(), []);
    const scale = useMemo(() => new Vector3(), []);
    const geometry = useMemo(() => {
        const spriteGeometry = createSpriteGeometry(batch.sprite, atlasPage);
        addWobbleAttributes(spriteGeometry, atlasPage, batch);
        return spriteGeometry;
    }, [atlasPage, batch]);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const weather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow();
    const windSpeed =
        typeof weather?.windSpeed === 'number'
            ? weather.windSpeed
            : (weatherNow?.windSpeed ?? 0);
    const windDirectionDegrees =
        typeof weather?.windDirection === 'number'
            ? weather.windDirection
            : typeof weatherNow?.windDirection === 'string'
              ? (compassToDirection[weatherNow.windDirection] ?? 0)
              : 0;
    const windDirectionX = Math.sin((windDirectionDegrees * Math.PI) / 180);
    const windDirectionZ = -Math.cos((windDirectionDegrees * Math.PI) / 180);
    const windStrength = Math.max(0, Math.min(1, windSpeed / 16));
    const brightness = getSpriteBrightness(timeOfDay, weather);
    const material = useMemo(() => {
        const batchMaterial = new MeshLambertMaterial({
            alphaTest: batch.alphaTest,
            color: 'white',
            depthWrite: false,
            map: texture,
            opacity: batch.opacity,
            transparent: true,
        });
        applyGroundDecorationWobbleShader(batchMaterial);
        return batchMaterial;
    }, [batch.alphaTest, batch.opacity, texture]);

    useLayoutEffect(() => {
        material.color.setScalar(brightness);
    }, [brightness, material]);

    useLayoutEffect(() => {
        const uniforms = material.userData.groundDecorationShader?.uniforms as
            | GroundDecorationShaderUniforms
            | undefined;

        uniforms?.uWindDirection?.value.set(windDirectionX, 0, windDirectionZ);
        if (uniforms?.uWindStrength) {
            uniforms.uWindStrength.value = windStrength;
        }
    }, [material, windDirectionX, windDirectionZ, windStrength]);

    useLayoutEffect(() => () => geometry.dispose(), [geometry]);
    useLayoutEffect(() => () => material.dispose(), [material]);

    const updateMatrices = (cameraQuaternion: Quaternion) => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        batch.instances.forEach((instance, index) => {
            position.set(...instance.position);
            rotationZ.setFromEuler(new Euler(0, 0, instance.rotationZ));
            quaternion.copy(cameraQuaternion).multiply(rotationZ);
            scale.set(
                instance.height * batch.sprite.aspect,
                instance.height,
                1,
            );
            matrix.compose(position, quaternion, scale);
            mesh.setMatrixAt(index, matrix);
        });

        mesh.count = batch.instances.length;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    };

    useLayoutEffect(() => {
        previousCameraQuaternion.current.set(0, 0, 0, 0);
    });

    useFrame(({ camera, clock }) => {
        const uniforms = material.userData.groundDecorationShader?.uniforms as
            | GroundDecorationShaderUniforms
            | undefined;

        if (uniforms?.uTime) {
            uniforms.uTime.value = clock.getElapsedTime();
        }
        uniforms?.uWindDirection?.value.set(windDirectionX, 0, windDirectionZ);
        if (uniforms?.uWindStrength) {
            uniforms.uWindStrength.value = windStrength;
        }

        if (previousCameraQuaternion.current.equals(camera.quaternion)) {
            return;
        }

        updateMatrices(camera.quaternion);
        previousCameraQuaternion.current.copy(camera.quaternion);
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, batch.instances.length]}
            receiveShadow
            renderOrder={20}
        />
    );
}
