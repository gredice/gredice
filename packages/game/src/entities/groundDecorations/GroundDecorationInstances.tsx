'use client';

import { useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
    Box3,
    DynamicDrawUsage,
    Euler,
    Frustum,
    InstancedBufferAttribute,
    type InstancedMesh,
    type IUniform,
    Matrix4,
    MeshLambertMaterial,
    PlaneGeometry,
    Quaternion,
    Vector3,
} from 'three';
import { SeededRNG } from '../../generators/plant/lib/rng';
import { useWeatherNow } from '../../hooks/useWeatherNow';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import { useSceneTimeUniform } from '../../scene/SceneTime';
import { resolveSpriteAtlasAssetPaths } from '../../sprites/resolveSpriteAtlasAssetPaths';
import { getSpriteBrightness } from '../../sprites/spriteLighting';
import type { SpriteAtlasPage, SpriteAtlasSprite } from '../../sprites/types';
import { useSpriteAtlasManifest } from '../../sprites/useSpriteAtlasManifest';
import { useSpriteAtlasTexture } from '../../sprites/useSpriteAtlasTexture';
import { useGameState } from '../../useGameState';
import { estimateRgba8MipmappedTextureBytes } from './groundDecorationAtlasMemory';
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
    atlasPageIndex: number;
    instances: GroundDecorationBatchInstance[];
    key: string;
};

type GroundDecorationBatchInstance = GroundDecorationInstance & {
    aspect: number;
    uvTransform: [
        offsetU: number,
        offsetV: number,
        scaleU: number,
        scaleV: number,
    ];
    wobble: [
        waveScale: number,
        driftScale: number,
        phase: number,
        speedScale: number,
    ];
};

type GroundDecorationChunk = {
    bounds: Box3;
    instances: GroundDecorationBatchInstance[];
    key: string;
};

type GroundDecorationProfileBatchStats = {
    atlasPageIndex: number;
    chunkKeys: string[];
    instanceCount: number;
    visibleCount: number;
};

type RecordGroundDecorationProfileBatch = (
    key: string,
    stats: GroundDecorationProfileBatchStats | null,
) => void;

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

const decorationChunkSize = 4;
const decorationChunkCullMargin = 2.5;

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

function createSpriteGeometry(maxInstanceCount: number) {
    const geometry = new PlaneGeometry(1, 1);
    geometry.translate(0, 0.5, 0);

    geometry.setAttribute(
        'instanceWobble',
        new InstancedBufferAttribute(
            new Float32Array(maxInstanceCount * 4),
            4,
        ).setUsage(DynamicDrawUsage),
    );
    geometry.setAttribute(
        'instanceAlphaOpacity',
        new InstancedBufferAttribute(
            new Float32Array(maxInstanceCount * 2),
            2,
        ).setUsage(DynamicDrawUsage),
    );
    geometry.setAttribute(
        'instanceUvTransform',
        new InstancedBufferAttribute(
            new Float32Array(maxInstanceCount * 4),
            4,
        ).setUsage(DynamicDrawUsage),
    );

    return geometry;
}

function createBatchInstance({
    atlasPage,
    instance,
    sprite,
}: {
    atlasPage: SpriteAtlasPage;
    instance: GroundDecorationInstance;
    sprite: SpriteAtlasSprite;
}): GroundDecorationBatchInstance {
    const positionKey = instance.position
        .map((value) => value.toFixed(3))
        .join(':');
    const rng = new SeededRNG(
        `${groundDecorationAtlasBasePath}:${atlasPage.index}:${instance.spriteName}:${positionKey}`,
    );
    const atlas = atlasPage.atlas;
    const u0 = sprite.frame.x / atlas.width;
    const u1 = (sprite.frame.x + sprite.frame.width) / atlas.width;
    const v0 = 1 - (sprite.frame.y + sprite.frame.height) / atlas.height;
    const v1 = 1 - sprite.frame.y / atlas.height;

    return {
        ...instance,
        aspect: sprite.aspect,
        uvTransform: [u0, v0, u1 - u0, v1 - v0],
        wobble: [
            rng.nextRange(1.15, 1.75),
            rng.nextRange(0.7, 1.25),
            rng.nextRange(0, Math.PI * 2),
            rng.nextRange(0.9, 1.35),
        ],
    };
}

function createGroundDecorationChunks(
    instances: GroundDecorationBatchInstance[],
) {
    const chunksByKey = new Map<string, GroundDecorationChunk>();

    for (const instance of instances) {
        const chunkX = Math.floor(instance.position[0] / decorationChunkSize);
        const chunkZ = Math.floor(instance.position[2] / decorationChunkSize);
        const chunkKey = `${chunkX}:${chunkZ}`;
        const width = instance.height * instance.aspect;
        const halfWidth = width / 2;
        const instanceBounds = new Box3(
            new Vector3(
                instance.position[0] - halfWidth,
                instance.position[1],
                instance.position[2] - halfWidth,
            ),
            new Vector3(
                instance.position[0] + halfWidth,
                instance.position[1] + instance.height,
                instance.position[2] + halfWidth,
            ),
        );
        const chunk = chunksByKey.get(chunkKey);

        if (chunk) {
            chunk.instances.push(instance);
            chunk.bounds.union(instanceBounds);
            continue;
        }

        chunksByKey.set(chunkKey, {
            bounds: instanceBounds,
            instances: [instance],
            key: chunkKey,
        });
    }

    const chunks = [...chunksByKey.values()];
    for (const chunk of chunks) {
        chunk.bounds.expandByScalar(decorationChunkCullMargin);
    }

    return chunks;
}

function applyGroundDecorationWobbleShader(
    material: MeshLambertMaterial,
    timeUniform: IUniform<number>,
) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = timeUniform;
        shader.uniforms.uWindDirection = { value: new Vector3(0, 0, -1) };
        shader.uniforms.uWindStrength = { value: 0 };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
#include <common>
attribute vec4 instanceWobble;
attribute vec2 instanceAlphaOpacity;
attribute vec4 instanceUvTransform;
varying float vGroundDecorationAlphaTest;
varying float vGroundDecorationOpacity;
uniform float uTime;
uniform vec3 uWindDirection;
uniform float uWindStrength;
`,
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <uv_vertex>',
            `
#include <uv_vertex>
#ifdef USE_MAP
vMapUv = instanceUvTransform.xy + uv * instanceUvTransform.zw;
#endif
`,
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
vGroundDecorationAlphaTest = instanceAlphaOpacity.x;
vGroundDecorationOpacity = instanceAlphaOpacity.y;
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
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
#include <common>
varying float vGroundDecorationAlphaTest;
varying float vGroundDecorationOpacity;
`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
#include <color_fragment>
diffuseColor.a *= vGroundDecorationOpacity;
`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <alphatest_fragment>',
            `
if ( diffuseColor.a < vGroundDecorationAlphaTest ) discard;
`,
        );
        material.userData.groundDecorationShader = shader;
    };
    material.customProgramCacheKey = () => 'ground-decoration-sprite-batch-v3';
}

export function GroundDecorationInstances({
    farmId,
    instances,
}: {
    farmId?: number | null;
    instances: GroundDecorationInstance[];
}) {
    const profileBatchesRef = useRef(
        new Map<string, GroundDecorationProfileBatchStats>(),
    );
    const recordProfileBatch = useCallback<RecordGroundDecorationProfileBatch>(
        (key, stats) => {
            const profileBatches = profileBatchesRef.current;
            if (stats) {
                profileBatches.set(key, stats);
            } else {
                profileBatches.delete(key);
            }

            const groundDecorationAtlasPages = new Set<number>();
            const groundDecorationChunks = new Set<string>();
            let groundDecorationVisibleCount = 0;
            for (const batchStats of profileBatches.values()) {
                groundDecorationAtlasPages.add(batchStats.atlasPageIndex);
                for (const chunkKey of batchStats.chunkKeys) {
                    groundDecorationChunks.add(chunkKey);
                }
                groundDecorationVisibleCount += batchStats.visibleCount;
            }

            updateGameProfileMetadata({
                groundDecorationAtlasPageCount: groundDecorationAtlasPages.size,
                groundDecorationChunkCount: groundDecorationChunks.size,
                groundDecorationVisibleCount,
            });
        },
        [],
    );
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
    const groundDecorationAtlasEstimatedGpuBytes = useMemo(() => {
        if (!manifest) {
            return 0;
        }

        let bytes = 0;
        for (const pageIndex of instancesByPage.keys()) {
            const page = resolveAtlasPage(
                manifest.pages,
                pageIndex,
                manifest.atlas,
            );
            if (page) {
                bytes += estimateRgba8MipmappedTextureBytes(
                    page.atlas.width,
                    page.atlas.height,
                );
            }
        }
        return bytes;
    }, [instancesByPage, manifest]);

    useLayoutEffect(() => {
        updateGameProfileMetadata({
            groundDecorationAtlasEstimatedGpuBytes,
        });
    }, [groundDecorationAtlasEstimatedGpuBytes]);

    useLayoutEffect(
        () => () => {
            updateGameProfileMetadata({
                groundDecorationAtlasEstimatedGpuBytes: 0,
                groundDecorationAtlasPageCount: 0,
                groundDecorationChunkCount: 0,
                groundDecorationVisibleCount: 0,
            });
        },
        [],
    );

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
                            farmId={farmId}
                            instances={pageInstances}
                            manifestSprites={manifest.sprites}
                            recordProfileBatch={recordProfileBatch}
                        />
                    );
                },
            )}
        </>
    );
}

function GroundDecorationPageInstances({
    atlasPage,
    farmId,
    instances,
    manifestSprites,
    recordProfileBatch,
}: {
    atlasPage: SpriteAtlasPage;
    farmId?: number | null;
    instances: GroundDecorationInstance[];
    manifestSprites: Record<string, SpriteAtlasSprite>;
    recordProfileBatch: RecordGroundDecorationProfileBatch;
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
    const batch = useMemo<GroundDecorationBatch>(() => {
        const batchInstances: GroundDecorationBatchInstance[] = [];

        for (const instance of instances) {
            const sprite = manifestSprites[instance.spriteName];
            if (!sprite) {
                continue;
            }

            batchInstances.push(
                createBatchInstance({
                    atlasPage,
                    instance,
                    sprite,
                }),
            );
        }

        return {
            atlasPageIndex: atlasPage.index,
            instances: batchInstances,
            key: `page:${atlasPage.index}`,
        };
    }, [atlasPage, instances, manifestSprites]);

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

    if (batch.instances.length === 0) {
        return null;
    }

    return (
        <GroundDecorationInstancedBatch
            batch={batch}
            farmId={farmId}
            recordProfileBatch={recordProfileBatch}
            texture={texture}
        />
    );
}

function GroundDecorationInstancedBatch({
    batch,
    farmId,
    recordProfileBatch,
    texture,
}: {
    batch: GroundDecorationBatch;
    farmId?: number | null;
    recordProfileBatch: RecordGroundDecorationProfileBatch;
    texture: NonNullable<ReturnType<typeof useSpriteAtlasTexture>['texture']>;
}) {
    const meshRef = useRef<InstancedMesh | null>(null);
    const camera = useThree((state) => state.camera);
    const matrix = useMemo(() => new Matrix4(), []);
    const frustumMatrix = useMemo(() => new Matrix4(), []);
    const frustum = useMemo(() => new Frustum(), []);
    const position = useMemo(() => new Vector3(), []);
    const quaternion = useMemo(() => new Quaternion(), []);
    const rotationZ = useMemo(() => new Quaternion(), []);
    const scale = useMemo(() => new Vector3(), []);
    const geometry = useMemo(() => {
        return createSpriteGeometry(batch.instances.length);
    }, [batch.instances.length]);
    const chunks = useMemo(
        () => createGroundDecorationChunks(batch.instances),
        [batch.instances],
    );
    const gameCamera = useGameState((state) => state.gameCamera);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const weather = useGameState((state) => state.weather);
    const { data: weatherNow } = useWeatherNow(true, farmId);
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
    const timeUniform = useSceneTimeUniform();
    const material = useMemo(() => {
        const batchMaterial = new MeshLambertMaterial({
            color: 'white',
            depthWrite: false,
            map: texture,
            opacity: 1,
            transparent: true,
        });
        applyGroundDecorationWobbleShader(batchMaterial, timeUniform);
        return batchMaterial;
    }, [texture, timeUniform]);

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

    const updateMatrices = useCallback(
        (cameraQuaternion: Quaternion) => {
            const mesh = meshRef.current;
            if (!mesh) {
                return;
            }

            frustumMatrix.multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse,
            );
            frustum.setFromProjectionMatrix(frustumMatrix);

            const wobbleAttribute = geometry.getAttribute(
                'instanceWobble',
            ) as InstancedBufferAttribute;
            const alphaOpacityAttribute = geometry.getAttribute(
                'instanceAlphaOpacity',
            ) as InstancedBufferAttribute;
            const uvTransformAttribute = geometry.getAttribute(
                'instanceUvTransform',
            ) as InstancedBufferAttribute;
            let visibleIndex = 0;

            for (const chunk of chunks) {
                if (!frustum.intersectsBox(chunk.bounds)) {
                    continue;
                }

                for (const instance of chunk.instances) {
                    position.set(...instance.position);
                    rotationZ.setFromEuler(new Euler(0, 0, instance.rotationZ));
                    quaternion.copy(cameraQuaternion).multiply(rotationZ);
                    scale.set(
                        instance.height * instance.aspect,
                        instance.height,
                        1,
                    );
                    matrix.compose(position, quaternion, scale);
                    mesh.setMatrixAt(visibleIndex, matrix);
                    wobbleAttribute.setXYZW(visibleIndex, ...instance.wobble);
                    alphaOpacityAttribute.setXY(
                        visibleIndex,
                        instance.alphaTest,
                        instance.opacity,
                    );
                    uvTransformAttribute.setXYZW(
                        visibleIndex,
                        ...instance.uvTransform,
                    );
                    visibleIndex += 1;
                }
            }

            mesh.count = visibleIndex;
            mesh.visible = visibleIndex > 0;
            mesh.instanceMatrix.needsUpdate = true;
            wobbleAttribute.needsUpdate = true;
            alphaOpacityAttribute.needsUpdate = true;
            uvTransformAttribute.needsUpdate = true;
            mesh.computeBoundingBox();
            mesh.computeBoundingSphere();
            recordProfileBatch(batch.key, {
                atlasPageIndex: batch.atlasPageIndex,
                chunkKeys: chunks.map((chunk) => chunk.key),
                instanceCount: batch.instances.length,
                visibleCount: visibleIndex,
            });
        },
        [
            batch.instances.length,
            batch.key,
            batch.atlasPageIndex,
            camera,
            chunks,
            frustum,
            frustumMatrix,
            geometry,
            matrix,
            position,
            quaternion,
            recordProfileBatch,
            rotationZ,
            scale,
        ],
    );

    useLayoutEffect(() => {
        if (!gameCamera) {
            updateMatrices(camera.quaternion);
            return;
        }

        return gameCamera.subscribe(() => updateMatrices(camera.quaternion));
    }, [camera, gameCamera, updateMatrices]);

    useLayoutEffect(
        () => () => {
            recordProfileBatch(batch.key, null);
        },
        [batch.key, recordProfileBatch],
    );

    return (
        <instancedMesh
            ref={meshRef}
            name={`GroundDecorations:page:${batch.atlasPageIndex}:instances:${batch.instances.length}`}
            args={[geometry, material, batch.instances.length]}
            receiveShadow
            renderOrder={20}
        />
    );
}
