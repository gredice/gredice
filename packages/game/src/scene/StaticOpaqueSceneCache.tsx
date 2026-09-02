'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';
import {
    ACESFilmicToneMapping,
    AlwaysDepth,
    type Camera,
    Color,
    DataTexture,
    DepthFormat,
    DepthTexture,
    GLSL3,
    type Group,
    type Material,
    Matrix4,
    NearestFilter,
    NoBlending,
    NoColorSpace,
    type Object3D,
    RGBAFormat,
    type Scene,
    ShaderMaterial,
    SRGBColorSpace,
    type Texture,
    UnsignedByteType,
    UnsignedIntType,
    Vector2,
    type WebGLRenderer,
    WebGLRenderTarget,
} from 'three';
import { useOptionalGameState } from '../useGameState';
import {
    type CloudShadowMaterialUniforms,
    getCloudShadowAttenuationMaterialUniforms,
} from './cloudShadowAttenuation';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import { useSceneRenderRequest, useSceneResume } from './SceneTime';
import {
    createStaticOpaqueSceneCacheReplay,
    isStaticOpaqueSceneCacheReplayEligible,
    type StaticOpaqueSceneCacheReplay,
    staticOpaqueSceneCacheReplayVertexShader,
} from './staticOpaqueSceneCacheReplay';
import {
    createStaticOpaqueSceneCacheRuntime,
    isStaticOpaqueSceneCacheMaterialEligible,
    resolveStaticOpaqueSceneCacheTarget,
    type StaticOpaqueSceneCacheReason,
    type StaticOpaqueSceneCacheRuntime,
    transitionStaticOpaqueSceneCache,
} from './staticOpaqueSceneCacheState';
import { useWeatherSurfaceUniformActivitySnapshot } from './WeatherSurfaceUniformProvider';

export type StaticOpaqueSceneCacheGroup = 'base-terrain' | 'static-props';

type StaticOpaqueSceneCacheBoundaryEntry = {
    contentKey: unknown;
    group: StaticOpaqueSceneCacheGroup;
    instanceCount: number;
    root: Object3D;
    submissionCount: number;
    triangleCount: number;
};

type StaticOpaqueSceneCacheRegistrySnapshot = {
    boundaries: readonly StaticOpaqueSceneCacheBoundaryEntry[];
    boundarySignature: string;
    ineligibleBoundaryCount: number;
    instanceCount: number;
    invalidationCount: number;
    lastInvalidationReason: StaticOpaqueSceneCacheReason;
    meshCount: number;
    renderables: readonly Object3D[];
    revision: number;
    submissionCount: number;
    triangleCount: number;
};

class StaticOpaqueSceneCacheRegistry {
    private readonly boundaries = new Map<
        symbol,
        StaticOpaqueSceneCacheBoundaryEntry
    >();
    private readonly listeners = new Set<() => void>();
    private snapshot: StaticOpaqueSceneCacheRegistrySnapshot = {
        boundaries: [],
        boundarySignature: '',
        ineligibleBoundaryCount: 0,
        instanceCount: 0,
        invalidationCount: 0,
        lastInvalidationReason: 'boundary-change',
        meshCount: 0,
        renderables: [],
        revision: 0,
        submissionCount: 0,
        triangleCount: 0,
    };

    constructor(private readonly onInvalidate: () => void) {}

    deleteBoundary = (id: symbol) => {
        if (!this.boundaries.delete(id)) {
            return;
        }
        this.bump('boundary-change');
    };

    getSnapshot = () => this.snapshot;

    invalidate = (reason: StaticOpaqueSceneCacheReason) => {
        this.bump(reason);
    };

    setBoundary = (
        id: symbol,
        boundary: StaticOpaqueSceneCacheBoundaryEntry,
    ) => {
        const previous = this.boundaries.get(id);
        if (
            previous &&
            previous.contentKey === boundary.contentKey &&
            previous.group === boundary.group &&
            previous.instanceCount === boundary.instanceCount &&
            previous.root === boundary.root &&
            previous.submissionCount === boundary.submissionCount &&
            previous.triangleCount === boundary.triangleCount
        ) {
            return;
        }

        this.boundaries.set(id, boundary);
        this.bump('boundary-change');
    };

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    private bump(reason: StaticOpaqueSceneCacheReason) {
        const mountedBoundaries = [...this.boundaries.values()].filter(
            (boundary) => boundary.root.parent !== null,
        );
        const boundaries: StaticOpaqueSceneCacheBoundaryEntry[] = [];
        const renderables: Object3D[] = [];
        let ineligibleBoundaryCount = 0;
        let instanceCount = 0;
        let meshCount = 0;
        let submissionCount = 0;
        let triangleCount = 0;
        for (const boundary of mountedBoundaries) {
            const boundaryRenderables: Object3D[] = [];
            boundary.root.traverse((object) => {
                if (isRenderable(object)) {
                    boundaryRenderables.push(object);
                }
            });
            if (
                boundaryRenderables.length === 0 ||
                boundaryRenderables.some(
                    (object) => !isStaticOpaqueRenderableEligible(object),
                )
            ) {
                ineligibleBoundaryCount += 1;
                continue;
            }

            boundaries.push(boundary);
            renderables.push(...boundaryRenderables);
            instanceCount += boundary.instanceCount;
            submissionCount += boundary.submissionCount;
            triangleCount += boundary.triangleCount;
            meshCount += boundaryRenderables.length;
        }
        this.snapshot = {
            boundaries,
            boundarySignature: buildBoundarySignature(boundaries),
            ineligibleBoundaryCount,
            instanceCount,
            invalidationCount: this.snapshot.invalidationCount + 1,
            lastInvalidationReason: reason,
            meshCount,
            renderables,
            revision: this.snapshot.revision + 1,
            submissionCount,
            triangleCount,
        };
        for (const listener of this.listeners) {
            listener();
        }
        this.onInvalidate();
    }
}

const StaticOpaqueSceneCacheContext =
    createContext<StaticOpaqueSceneCacheRegistry | null>(null);

export function StaticOpaqueSceneCacheBoundary({
    children,
    contentKey,
    group,
    instanceCount,
    submissionCount,
    triangleCount,
}: {
    children: ReactNode;
    contentKey: unknown;
    group?: StaticOpaqueSceneCacheGroup;
    instanceCount: number;
    submissionCount: number;
    triangleCount: number;
}) {
    const registry = useContext(StaticOpaqueSceneCacheContext);
    const id = useMemo(() => Symbol(group ?? 'disabled'), [group]);
    const rootRef = useRef<Group>(null);

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!registry || !group || !root) {
            return;
        }

        registry.setBoundary(id, {
            contentKey,
            group,
            instanceCount,
            root,
            submissionCount,
            triangleCount,
        });
    }, [
        contentKey,
        group,
        id,
        instanceCount,
        registry,
        submissionCount,
        triangleCount,
    ]);

    useLayoutEffect(
        () => () => {
            registry?.deleteBoundary(id);
        },
        [id, registry],
    );

    if (!group || !registry) {
        return children;
    }

    return (
        <group ref={rootRef} name={`StaticOpaqueCache:${group}`}>
            {children}
        </group>
    );
}

type StaticOpaqueSceneCacheCounters = {
    bypassFrames: number;
    captureSubmissions: number;
    captureTriangles: number;
    captures: number;
    compositePasses: number;
    replayEstimatedBytes: number;
    replaySubmissions: number;
    replayTriangles: number;
    hitFrames: number;
    invalidations: number;
    lastInvalidationReason: StaticOpaqueSceneCacheReason;
    liveFrames: number;
    savedSubmissions: number;
    savedTriangles: number;
    unexpectedStaticSubmissions: number;
};

function createCounters(): StaticOpaqueSceneCacheCounters {
    return {
        bypassFrames: 0,
        captureSubmissions: 0,
        captureTriangles: 0,
        captures: 0,
        compositePasses: 0,
        replayEstimatedBytes: 0,
        replaySubmissions: 0,
        replayTriangles: 0,
        hitFrames: 0,
        invalidations: 0,
        lastInvalidationReason: 'boundary-change',
        liveFrames: 0,
        savedSubmissions: 0,
        savedTriangles: 0,
        unexpectedStaticSubmissions: 0,
    };
}

function isRenderable(object: Object3D) {
    return (
        Reflect.get(object, 'isMesh') === true ||
        Reflect.get(object, 'isLine') === true ||
        Reflect.get(object, 'isPoints') === true ||
        Reflect.get(object, 'isSprite') === true
    );
}

function getMaterials(object: Object3D): Material[] {
    const material = Reflect.get(object, 'material');
    if (Array.isArray(material)) {
        return material.filter(
            (entry): entry is Material =>
                typeof entry === 'object' &&
                entry !== null &&
                Reflect.get(entry, 'isMaterial') === true,
        );
    }

    return typeof material === 'object' &&
        material !== null &&
        Reflect.get(material, 'isMaterial') === true
        ? [material]
        : [];
}

function isStaticOpaqueRenderableEligible(object: Object3D) {
    if (Reflect.get(object, 'isMesh') !== true) {
        return false;
    }

    const materials = getMaterials(object);
    return (
        materials.length > 0 &&
        isStaticOpaqueSceneCacheReplayEligible(object) &&
        materials.every((material) =>
            isStaticOpaqueSceneCacheMaterialEligible(material),
        )
    );
}

function countIneligibleStaticOpaqueSceneCacheBoundaries(
    boundaries: readonly StaticOpaqueSceneCacheBoundaryEntry[],
) {
    let count = 0;
    for (const boundary of boundaries) {
        let eligible = true;
        boundary.root.traverse((object) => {
            if (
                eligible &&
                isRenderable(object) &&
                !isStaticOpaqueRenderableEligible(object)
            ) {
                eligible = false;
            }
        });
        if (!eligible) {
            count += 1;
        }
    }
    return count;
}

function signatureNumbers(values: readonly number[]) {
    return values
        .map((value) => (Number.isFinite(value) ? value.toFixed(6) : '0'))
        .join(',');
}

function mixRuntimeSignature(hash: number, value: number) {
    const normalized = Number.isFinite(value)
        ? Math.round(value * 1_000_000)
        : 0;
    return Math.imul(hash ^ normalized, 16_777_619) >>> 0;
}

function mixOptionalColorSignature(hash: number, value: unknown) {
    if (typeof value !== 'object' || value === null) {
        return mixRuntimeSignature(hash, 0);
    }
    const getHex = Reflect.get(value, 'getHex');
    return mixRuntimeSignature(
        hash,
        typeof getHex === 'function' ? getHex.call(value) : 0,
    );
}

function buildBoundaryRuntimeSignature(
    boundaries: readonly StaticOpaqueSceneCacheBoundaryEntry[],
    renderables: readonly Object3D[],
) {
    for (const boundary of boundaries) {
        boundary.root.updateWorldMatrix(true, true);
    }

    let hash = 2_166_136_261;
    for (const object of renderables) {
        hash = mixRuntimeSignature(hash, isEffectivelyVisible(object) ? 1 : 0);
        hash = mixRuntimeSignature(hash, object.layers.mask);
        hash = mixRuntimeSignature(hash, object.renderOrder);
        hash = mixRuntimeSignature(
            hash,
            Reflect.get(object, 'castShadow') === true ? 1 : 0,
        );
        hash = mixRuntimeSignature(
            hash,
            Reflect.get(object, 'receiveShadow') === true ? 1 : 0,
        );
        hash = mixRuntimeSignature(hash, object.frustumCulled ? 1 : 0);
        for (const value of object.matrixWorld.elements) {
            hash = mixRuntimeSignature(hash, value);
        }

        const geometry = Reflect.get(object, 'geometry');
        hash = mixRuntimeSignature(hash, geometry?.version ?? 0);
        hash = mixRuntimeSignature(hash, geometry?.drawRange?.start ?? 0);
        hash = mixRuntimeSignature(hash, geometry?.drawRange?.count ?? 0);
        hash = mixRuntimeSignature(hash, geometry?.index?.version ?? 0);
        for (const attributeName of [
            'color',
            'normal',
            'position',
            'tangent',
            'uv',
            'uv1',
        ]) {
            hash = mixRuntimeSignature(
                hash,
                geometry?.getAttribute?.(attributeName)?.version ?? 0,
            );
        }

        const instanceCount = Reflect.get(object, 'count');
        hash = mixRuntimeSignature(
            hash,
            typeof instanceCount === 'number' ? instanceCount : 0,
        );
        hash = mixRuntimeSignature(
            hash,
            Reflect.get(object, 'instanceMatrix')?.version ?? 0,
        );
        hash = mixRuntimeSignature(
            hash,
            Reflect.get(object, 'instanceColor')?.version ?? 0,
        );
        const morphTargetInfluences = Reflect.get(
            object,
            'morphTargetInfluences',
        );
        if (Array.isArray(morphTargetInfluences)) {
            for (const influence of morphTargetInfluences) {
                hash = mixRuntimeSignature(hash, influence);
            }
        }

        for (const material of getMaterials(object)) {
            hash = mixRuntimeSignature(hash, material.version);
            hash = mixRuntimeSignature(hash, material.visible ? 1 : 0);
            hash = mixRuntimeSignature(hash, material.transparent ? 1 : 0);
            hash = mixRuntimeSignature(hash, material.opacity);
            hash = mixRuntimeSignature(hash, material.alphaTest);
            hash = mixRuntimeSignature(hash, material.alphaToCoverage ? 1 : 0);
            hash = mixRuntimeSignature(hash, material.depthTest ? 1 : 0);
            hash = mixRuntimeSignature(hash, material.depthWrite ? 1 : 0);
            hash = mixRuntimeSignature(hash, material.colorWrite ? 1 : 0);
            hash = mixRuntimeSignature(hash, material.stencilWrite ? 1 : 0);
            hash = mixRuntimeSignature(hash, material.toneMapped ? 1 : 0);
            const transmission = Reflect.get(material, 'transmission');
            hash = mixRuntimeSignature(
                hash,
                typeof transmission === 'number' ? transmission : 0,
            );
            hash = mixOptionalColorSignature(
                hash,
                Reflect.get(material, 'color'),
            );
            hash = mixOptionalColorSignature(
                hash,
                Reflect.get(material, 'emissive'),
            );
            for (const property of [
                'aoMapIntensity',
                'bumpScale',
                'displacementBias',
                'displacementScale',
                'emissiveIntensity',
                'envMapIntensity',
                'lightMapIntensity',
                'metalness',
                'roughness',
            ]) {
                const value = Reflect.get(material, property);
                hash = mixRuntimeSignature(
                    hash,
                    typeof value === 'number' ? value : 0,
                );
            }
            for (const textureProperty of [
                'alphaMap',
                'aoMap',
                'bumpMap',
                'displacementMap',
                'emissiveMap',
                'envMap',
                'lightMap',
                'map',
                'metalnessMap',
                'normalMap',
                'roughnessMap',
            ]) {
                const texture = Reflect.get(material, textureProperty);
                hash = mixRuntimeSignature(hash, texture?.id ?? 0);
                hash = mixRuntimeSignature(hash, texture?.version ?? 0);
            }
        }
    }
    return hash.toString(36);
}

function buildCameraSignature(camera: Camera) {
    camera.updateWorldMatrix(true, false);
    return [
        camera.layers.mask,
        signatureNumbers(camera.matrixWorld.elements),
        signatureNumbers(camera.projectionMatrix.elements),
    ].join('|');
}

function buildLightingSignature(scene: Object3D) {
    const sceneEnvironment = Reflect.get(scene, 'environment');
    const environmentRotation = Reflect.get(scene, 'environmentRotation');
    const fog = Reflect.get(scene, 'fog');
    const parts: string[] = [
        [
            'environment',
            typeof sceneEnvironment?.uuid === 'string'
                ? sceneEnvironment.uuid
                : 'none',
            typeof sceneEnvironment?.version === 'number'
                ? sceneEnvironment.version
                : 0,
            typeof Reflect.get(scene, 'environmentIntensity') === 'number'
                ? Reflect.get(scene, 'environmentIntensity').toFixed(6)
                : 'none',
            typeof environmentRotation?.x === 'number'
                ? environmentRotation.x.toFixed(6)
                : 'none',
            typeof environmentRotation?.y === 'number'
                ? environmentRotation.y.toFixed(6)
                : 'none',
            typeof environmentRotation?.z === 'number'
                ? environmentRotation.z.toFixed(6)
                : 'none',
        ].join(':'),
        [
            'fog',
            typeof fog?.uuid === 'string' ? fog.uuid : 'none',
            typeof fog?.color?.getHexString === 'function'
                ? fog.color.getHexString()
                : 'none',
            typeof fog?.near === 'number' ? fog.near.toFixed(6) : 'none',
            typeof fog?.far === 'number' ? fog.far.toFixed(6) : 'none',
            typeof fog?.density === 'number' ? fog.density.toFixed(6) : 'none',
        ].join(':'),
    ];
    scene.traverse((object) => {
        if (Reflect.get(object, 'isLight') !== true) {
            return;
        }

        object.updateWorldMatrix(true, false);
        const color = Reflect.get(object, 'color');
        const groundColor = Reflect.get(object, 'groundColor');
        const intensity = Reflect.get(object, 'intensity');
        const shadow = Reflect.get(object, 'shadow');
        const shadowCamera = shadow ? Reflect.get(shadow, 'camera') : undefined;
        const shadowMapSize = shadow
            ? Reflect.get(shadow, 'mapSize')
            : undefined;
        const target = Reflect.get(object, 'target');
        if (target && typeof target.updateWorldMatrix === 'function') {
            target.updateWorldMatrix(true, false);
        }
        parts.push(
            [
                object.uuid,
                object.type,
                isEffectivelyVisible(object) ? 1 : 0,
                Reflect.get(object, 'castShadow') === true ? 1 : 0,
                object.layers.mask,
                typeof color?.getHexString === 'function'
                    ? color.getHexString()
                    : 'none',
                typeof groundColor?.getHexString === 'function'
                    ? groundColor.getHexString()
                    : 'none',
                typeof intensity === 'number' ? intensity.toFixed(6) : 'none',
                signatureNumbers(object.matrixWorld.elements),
                target?.matrixWorld?.elements
                    ? signatureNumbers(target.matrixWorld.elements)
                    : 'none',
                typeof shadow?.intensity === 'number'
                    ? shadow.intensity.toFixed(6)
                    : 'none',
                typeof shadow?.bias === 'number'
                    ? shadow.bias.toFixed(6)
                    : 'none',
                typeof shadow?.normalBias === 'number'
                    ? shadow.normalBias.toFixed(6)
                    : 'none',
                typeof shadow?.radius === 'number'
                    ? shadow.radius.toFixed(6)
                    : 'none',
                typeof shadow?.blurSamples === 'number'
                    ? shadow.blurSamples
                    : 'none',
                typeof shadowMapSize?.x === 'number' ? shadowMapSize.x : 'none',
                typeof shadowMapSize?.y === 'number' ? shadowMapSize.y : 'none',
                shadowCamera?.projectionMatrix?.elements
                    ? signatureNumbers(shadowCamera.projectionMatrix.elements)
                    : 'none',
            ].join(':'),
        );
    });
    return parts.sort().join('|');
}

function isEffectivelyVisible(object: Object3D) {
    let current: Object3D | null = object;
    while (current) {
        if (!current.visible) {
            return false;
        }
        current = current.parent;
    }
    return true;
}

function buildBoundarySignature(
    boundaries: readonly StaticOpaqueSceneCacheBoundaryEntry[],
) {
    const parts: string[] = [];
    for (const boundary of boundaries) {
        boundary.root.updateWorldMatrix(true, true);
        boundary.root.traverse((object) => {
            if (!isRenderable(object)) {
                return;
            }
            const geometry = Reflect.get(object, 'geometry');
            const instanceMatrix = Reflect.get(object, 'instanceMatrix');
            parts.push(
                [
                    object.uuid,
                    isEffectivelyVisible(object) ? 1 : 0,
                    object.layers.mask,
                    object.renderOrder,
                    typeof geometry?.uuid === 'string' ? geometry.uuid : 'none',
                    typeof geometry?.version === 'number'
                        ? geometry.version
                        : 0,
                    getMaterials(object)
                        .map((material) =>
                            [
                                material.uuid,
                                material.version,
                                material.visible ? 1 : 0,
                                material.transparent ? 1 : 0,
                                material.opacity.toFixed(6),
                                material.alphaTest.toFixed(6),
                                material.depthTest ? 1 : 0,
                                material.depthWrite ? 1 : 0,
                                material.colorWrite ? 1 : 0,
                            ].join(':'),
                        )
                        .join(','),
                    typeof Reflect.get(object, 'count') === 'number'
                        ? Reflect.get(object, 'count')
                        : 'none',
                    typeof instanceMatrix?.version === 'number'
                        ? instanceMatrix.version
                        : 'none',
                    signatureNumbers(object.matrixWorld.elements),
                ].join(':'),
            );
        });
    }
    return parts.sort().join('|');
}

function createOutputSpaceTarget({
    depthTexture,
    depthBuffer = depthTexture !== null,
    name,
    samples,
}: {
    depthBuffer?: boolean;
    depthTexture: DepthTexture | null;
    name: string;
    samples: number;
}) {
    const target = new WebGLRenderTarget(1, 1, {
        depthBuffer,
        depthTexture,
        format: RGBAFormat,
        internalFormat: 'RGBA8',
        magFilter: NearestFilter,
        minFilter: NearestFilter,
        resolveDepthBuffer: true,
        samples,
        stencilBuffer: false,
        type: UnsignedByteType,
    });
    target.texture.colorSpace = SRGBColorSpace;
    target.texture.generateMipmaps = false;
    target.texture.name = `${name}.Color`;
    target.viewport.set(0, 0, 1, 1);
    target.scissor.set(0, 0, 1, 1);
    target.scissorTest = false;

    /*
     * Three preserves the canvas tone-mapping/output pipeline for XR-style
     * targets. Keeping the cache in the same encoded RGBA8 representation
     * reuses the live material programs and avoids scene-linear variants that
     * would exist only for a cold capture.
     */
    Reflect.set(target, 'isXRRenderTarget', true);
    return target;
}

function createCloudResponseTarget() {
    return createOutputSpaceTarget({
        depthBuffer: false,
        depthTexture: null,
        name: 'StaticOpaqueSceneCache.CloudFullResponse',
        samples: 0,
    });
}

function createCloudResponseMaskTexture() {
    const texture = new DataTexture(
        new Uint8Array([255, 255, 255, 255]),
        1,
        1,
        RGBAFormat,
        UnsignedByteType,
    );
    texture.colorSpace = NoColorSpace;
    texture.generateMipmaps = false;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.name = 'StaticOpaqueSceneCache.CloudFullResponseMask';
    texture.needsUpdate = true;
    return texture;
}

function createCacheTarget(samples: number) {
    const depthTexture = new DepthTexture(1, 1, UnsignedIntType);
    depthTexture.format = DepthFormat;
    depthTexture.magFilter = NearestFilter;
    depthTexture.minFilter = NearestFilter;
    depthTexture.name = 'StaticOpaqueSceneCache.Depth';

    return {
        depthTexture,
        target: createOutputSpaceTarget({
            depthTexture,
            name: 'StaticOpaqueSceneCache',
            samples,
        }),
    };
}

function createCacheReplayMaterial({
    baseColorTexture,
    cloudUniforms,
    depthTexture,
    inverseViewProjection,
    shadowColorTexture,
}: {
    baseColorTexture: Texture;
    cloudUniforms: CloudShadowMaterialUniforms;
    depthTexture: Texture;
    inverseViewProjection: Matrix4;
    shadowColorTexture: Texture;
}) {
    return new ShaderMaterial({
        alphaToCoverage: true,
        blending: NoBlending,
        depthFunc: AlwaysDepth,
        depthTest: true,
        depthWrite: true,
        fragmentShader: `
            out vec4 cacheOutput;
            #define gl_FragColor cacheOutput

            uniform sampler2D cacheBaseColor;
            uniform sampler2D cacheShadowColor;
            uniform sampler2D cacheDepth;
            uniform sampler2D cloudShadowMap;
            uniform vec4 cloudShadowBounds;
            uniform vec2 cloudShadowProjection;
            uniform float cloudShadowStrength;
            uniform float cloudShadowHardness;
            uniform mat4 inverseViewProjection;

            void main() {
                ivec2 pixel = ivec2(gl_FragCoord.xy);
                vec4 baseColor = texelFetch(cacheBaseColor, pixel, 0);
                if (baseColor.a <= 0.000001) {
                    discard;
                }

                float cloudResponse = 0.0;
                float cachedDepth = texelFetch(cacheDepth, pixel, 0).r;
                if (
                    cloudShadowStrength > 0.001 &&
                    cachedDepth < 0.9999999
                ) {
                    vec2 textureSizePixels =
                        vec2(textureSize(cacheDepth, 0));
                    vec2 cacheUv =
                        (vec2(pixel) + vec2(0.5)) / textureSizePixels;
                    vec4 worldPosition = inverseViewProjection * vec4(
                        cacheUv * 2.0 - 1.0,
                        cachedDepth * 2.0 - 1.0,
                        1.0
                    );
                    vec3 world =
                        worldPosition.xyz / max(worldPosition.w, 0.000001);
                    vec2 groundPosition =
                        world.xz - cloudShadowProjection * world.y;
                    vec2 cloudUv =
                        (groundPosition - cloudShadowBounds.xy) *
                        cloudShadowBounds.zw;
                    float inBounds =
                        step(0.0, cloudUv.x) *
                        step(0.0, cloudUv.y) *
                        step(cloudUv.x, 1.0) *
                        step(cloudUv.y, 1.0);
                    float cloudMask =
                        texture(cloudShadowMap, cloudUv).r * inBounds;
                    float hardMask = smoothstep(0.08, 0.52, cloudMask);
                    cloudResponse =
                        mix(cloudMask, hardMask, cloudShadowHardness) *
                        cloudShadowStrength;
                }

                vec3 normalizedBase =
                    baseColor.rgb / max(baseColor.a, 0.000001);
                float response = clamp(cloudResponse, 0.0, 1.0);
                vec3 cachedColor = normalizedBase;
                if (response > 0.000001) {
                    vec4 shadowColor =
                        texelFetch(cacheShadowColor, pixel, 0);
                    vec3 normalizedShadow =
                        shadowColor.rgb /
                        max(shadowColor.a, 0.000001);
                    cachedColor = mix(
                        normalizedBase,
                        normalizedShadow,
                        response
                    );
                }
                float coverage = clamp(baseColor.a, 0.0, 1.0);
                gl_FragDepth = cachedDepth;
                gl_FragColor = vec4(cachedColor, coverage);
            }
        `,
        glslVersion: GLSL3,
        toneMapped: false,
        uniforms: {
            cacheBaseColor: { value: baseColorTexture },
            cacheShadowColor: { value: shadowColorTexture },
            cacheDepth: { value: depthTexture },
            cloudShadowBounds: cloudUniforms.bounds,
            cloudShadowHardness: cloudUniforms.hardness,
            cloudShadowMap: cloudUniforms.map,
            cloudShadowProjection: cloudUniforms.projection,
            cloudShadowStrength: cloudUniforms.strength,
            inverseViewProjection: { value: inverseViewProjection },
        },
        vertexShader: staticOpaqueSceneCacheReplayVertexShader,
    });
}

function restoreVisibility(
    changedVisibility: readonly {
        object: Object3D;
        visible: boolean;
    }[],
) {
    for (const { object, visible } of changedVisibility) {
        object.visible = visible;
    }
}

function captureStaticScene({
    boundaries,
    camera,
    gl,
    scene,
    target,
}: {
    boundaries: readonly StaticOpaqueSceneCacheBoundaryEntry[];
    camera: Parameters<WebGLRenderer['render']>[1];
    gl: WebGLRenderer;
    scene: Scene;
    target: WebGLRenderTarget;
}) {
    const allowed = new Set<Object3D>();
    for (const boundary of boundaries) {
        boundary.root.traverse((object) => allowed.add(object));
    }

    const changedVisibility: { object: Object3D; visible: boolean }[] = [];
    scene.traverse((object) => {
        if (isRenderable(object) && !allowed.has(object) && object.visible) {
            changedVisibility.push({ object, visible: true });
            object.visible = false;
        }
    });

    const previousAutoClear = gl.autoClear;
    const previousBackground = scene.background;
    const previousClearAlpha = gl.getClearAlpha();
    const previousClearColor = gl.getClearColor(new Color());
    const previousRenderTarget = gl.getRenderTarget();
    const previousActiveCubeFace = gl.getActiveCubeFace();
    const previousActiveMipmapLevel = gl.getActiveMipmapLevel();

    try {
        scene.background = null;
        gl.autoClear = false;
        target.viewport.set(0, 0, target.width, target.height);
        target.scissor.set(0, 0, target.width, target.height);
        target.scissorTest = false;
        gl.setRenderTarget(target);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, false);
        gl.render(scene, camera);

        const context = gl.getContext();
        return (
            context.checkFramebufferStatus(context.FRAMEBUFFER) ===
            context.FRAMEBUFFER_COMPLETE
        );
    } finally {
        gl.setRenderTarget(
            previousRenderTarget,
            previousActiveCubeFace,
            previousActiveMipmapLevel,
        );
        gl.setClearColor(previousClearColor, previousClearAlpha);
        gl.autoClear = previousAutoClear;
        scene.background = previousBackground;
        restoreVisibility(changedVisibility);
    }
}

function captureStaticCloudResponse({
    boundaries,
    camera,
    cloudUniforms,
    fullResponseMask,
    gl,
    responseTarget,
    scene,
    target,
}: {
    boundaries: readonly StaticOpaqueSceneCacheBoundaryEntry[];
    camera: Parameters<WebGLRenderer['render']>[1];
    cloudUniforms: CloudShadowMaterialUniforms;
    fullResponseMask: Texture;
    gl: WebGLRenderer;
    responseTarget: WebGLRenderTarget;
    scene: Scene;
    target: WebGLRenderTarget;
}) {
    const previousMap = cloudUniforms.map.value;
    const previousStrength = cloudUniforms.strength.value;
    try {
        if (previousMap !== null) {
            cloudUniforms.map.value = fullResponseMask;
            cloudUniforms.strength.value = 1;
            const responseCaptured = captureStaticScene({
                boundaries,
                camera,
                gl,
                scene,
                target,
            });
            if (!responseCaptured) {
                return {
                    captured: false,
                    submissions: 0,
                    triangles: 0,
                };
            }

            gl.initRenderTarget(responseTarget);
            gl.copyTextureToTexture(target.texture, responseTarget.texture);
        }

        cloudUniforms.map.value = previousMap;
        cloudUniforms.strength.value = 0;
        const submissionsBefore = gl.info.render.calls;
        const trianglesBefore = gl.info.render.triangles;
        return {
            captured: captureStaticScene({
                boundaries,
                camera,
                gl,
                scene,
                target,
            }),
            submissions: gl.info.render.calls - submissionsBefore,
            triangles: gl.info.render.triangles - trianglesBefore,
        };
    } finally {
        cloudUniforms.map.value = previousMap;
        cloudUniforms.strength.value = previousStrength;
    }
}

function renderCachedScene({
    boundaries,
    camera,
    gl,
    replay,
    scene,
}: {
    boundaries: readonly StaticOpaqueSceneCacheBoundaryEntry[];
    camera: Parameters<WebGLRenderer['render']>[1];
    gl: WebGLRenderer;
    replay: StaticOpaqueSceneCacheReplay;
    scene: Scene;
}) {
    const changedVisibility: { object: Object3D; visible: boolean }[] = [];
    const previousAutoClear = gl.autoClear;
    try {
        for (const { root } of boundaries) {
            if (root.visible) {
                changedVisibility.push({ object: root, visible: true });
                root.visible = false;
            }
        }
        scene.add(replay.scene);
        gl.setRenderTarget(null);
        gl.autoClear = true;
        gl.render(scene, camera);
        return 'ready';
    } finally {
        scene.remove(replay.scene);
        gl.autoClear = previousAutoClear;
        restoreVisibility(changedVisibility);
    }
}

function renderLiveScene({
    camera,
    gl,
    scene,
}: {
    camera: Parameters<WebGLRenderer['render']>[1];
    gl: WebGLRenderer;
    scene: Scene;
}) {
    gl.setRenderTarget(null);
    gl.render(scene, camera);
}

function getSignatureChangeReason(
    previous: readonly string[] | null,
    current: readonly string[],
    registryReason: StaticOpaqueSceneCacheReason,
): StaticOpaqueSceneCacheReason {
    if (!previous) {
        return 'boundary-change';
    }
    if (previous[0] !== current[0]) {
        return 'target-resize';
    }
    if (previous[1] !== current[1]) {
        return 'camera-change';
    }
    if (previous[2] !== current[2]) {
        return 'lighting-change';
    }
    if (previous[3] !== current[3]) {
        return registryReason;
    }
    return 'boundary-change';
}

function StaticOpaqueSceneCacheRenderer({
    enabled,
    interactionActive,
    qualityKey,
    registry,
    wireframe,
}: {
    enabled: boolean;
    interactionActive: boolean;
    qualityKey: string;
    registry: StaticOpaqueSceneCacheRegistry;
    wireframe: boolean;
}) {
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const drawingBufferSize = useMemo(() => new Vector2(), []);
    const cacheSampleCount = useMemo(() => {
        const context = gl.getContext();
        const samples = context.getParameter(context.SAMPLES);
        return typeof samples === 'number' && samples > 0
            ? Math.min(samples, gl.capabilities.maxSamples)
            : 0;
    }, [gl]);
    const cacheTarget = useMemo(() => {
        return createCacheTarget(cacheSampleCount);
    }, [cacheSampleCount]);
    const { depthTexture, target } = cacheTarget;
    const cloudUniforms = useMemo(
        getCloudShadowAttenuationMaterialUniforms,
        [],
    );
    const cloudFullResponseTarget = useMemo(createCloudResponseTarget, []);
    const cloudFullResponseMask = useMemo(createCloudResponseMaskTexture, []);
    const inverseViewProjection = useMemo(() => new Matrix4(), []);
    const cacheReplayMaterial = useMemo(() => {
        const material = createCacheReplayMaterial({
            baseColorTexture: target.texture,
            cloudUniforms,
            depthTexture,
            inverseViewProjection,
            shadowColorTexture: cloudFullResponseTarget.texture,
        });
        material.name = 'StaticOpaqueSceneCache.ColorReplay';
        return material;
    }, [
        cloudFullResponseTarget.texture,
        cloudUniforms,
        depthTexture,
        inverseViewProjection,
        target.texture,
    ]);
    const cacheReplay = useMemo(
        () =>
            createStaticOpaqueSceneCacheReplay({
                material: cacheReplayMaterial,
            }),
        [cacheReplayMaterial],
    );
    const countersRef = useRef(createCounters());
    const runtimeRef = useRef<StaticOpaqueSceneCacheRuntime>(
        createStaticOpaqueSceneCacheRuntime(),
    );
    const signaturePartsRef = useRef<readonly string[] | null>(null);
    const cachePathSupportedRef = useRef(true);
    const replayStatusRef = useRef('pending');
    const rainSurfaceIntensity = useOptionalGameState(
        (state) => state.rainSurfaceIntensity,
        0,
    );
    const snowCoverage = useOptionalGameState((state) => state.snowCoverage, 0);
    const closeupView = useOptionalGameState(
        (state) => state.view === 'closeup',
        false,
    );
    const weatherSurfaceActivity = useWeatherSurfaceUniformActivitySnapshot();
    const registrySnapshot = useSyncExternalStore(
        registry.subscribe,
        registry.getSnapshot,
        registry.getSnapshot,
    );

    const invalidateForResume = useCallback(() => {
        registry.invalidate('target-resize');
    }, [registry]);
    useSceneResume(invalidateForResume);

    useEffect(() => {
        const canvas = gl.domElement;
        const handleContextRestored = () => {
            cachePathSupportedRef.current = true;
            registry.invalidate('unsupported');
        };
        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        return () =>
            canvas.removeEventListener(
                'webglcontextrestored',
                handleContextRestored,
            );
    }, [gl.domElement, registry]);

    useEffect(
        () => () => {
            cloudFullResponseTarget.dispose();
            cloudFullResponseMask.dispose();
            cacheReplay.dispose();
            cacheReplayMaterial.dispose();
            target.dispose();
        },
        [
            cloudFullResponseTarget,
            cloudFullResponseMask,
            cacheReplay,
            cacheReplayMaterial,
            target,
        ],
    );

    useFrame(() => {
        gl.getDrawingBufferSize(drawingBufferSize);
        const targetConfig = resolveStaticOpaqueSceneCacheTarget({
            additionalBytes: cacheReplay.estimatedBytes,
            height: drawingBufferSize.y,
            sampleCount: cacheSampleCount,
            width: drawingBufferSize.x,
        });
        const targetWidth = targetConfig.supported ? targetConfig.width : 1;
        const targetHeight = targetConfig.supported ? targetConfig.height : 1;
        if (target.width !== targetWidth || target.height !== targetHeight) {
            target.setSize(targetWidth, targetHeight);
        }
        if (
            cloudFullResponseTarget.width !== targetWidth ||
            cloudFullResponseTarget.height !== targetHeight
        ) {
            cloudFullResponseTarget.setSize(targetWidth, targetHeight);
        }

        const boundaries = registrySnapshot.boundaries;
        const runtimeIneligibleBoundaryCount =
            countIneligibleStaticOpaqueSceneCacheBoundaries(boundaries);
        const ineligibleBoundaryCount =
            registrySnapshot.ineligibleBoundaryCount +
            runtimeIneligibleBoundaryCount;
        const boundaryMetrics = {
            instances: registrySnapshot.instanceCount,
            meshes: registrySnapshot.meshCount,
            submissions: registrySnapshot.submissionCount,
            triangles: registrySnapshot.triangleCount,
        };
        const context = gl.getContext();
        const webGlSupported =
            gl.capabilities.isWebGL2 &&
            cacheSampleCount > 0 &&
            gl.toneMapping === ACESFilmicToneMapping &&
            gl.outputColorSpace === SRGBColorSpace &&
            target.texture.colorSpace === SRGBColorSpace &&
            cloudFullResponseTarget.texture.colorSpace === SRGBColorSpace &&
            Reflect.get(target, 'isXRRenderTarget') === true &&
            !context.isContextLost() &&
            cachePathSupportedRef.current;
        const supported =
            targetConfig.supported &&
            webGlSupported &&
            boundaries.length > 0 &&
            runtimeIneligibleBoundaryCount === 0;
        const weatherActive =
            rainSurfaceIntensity > 0.001 ||
            snowCoverage > 0.001 ||
            weatherSurfaceActivity.rainActive ||
            weatherSurfaceActivity.rainSettling ||
            weatherSurfaceActivity.snowActive ||
            weatherSurfaceActivity.snowSettling;
        let bypassReason: StaticOpaqueSceneCacheReason | undefined;
        if (boundaries.length === 0) {
            bypassReason = 'empty';
        } else if (wireframe) {
            bypassReason = 'wireframe';
        } else if (interactionActive || closeupView) {
            bypassReason = 'interaction';
        } else if (weatherActive) {
            bypassReason = 'weather';
        } else if (
            gl.xr.isPresenting ||
            (gl.shadowMap.enabled && gl.shadowMap.autoUpdate) ||
            scene.overrideMaterial !== null
        ) {
            bypassReason = 'unsupported';
        } else if (gl.shadowMap.needsUpdate) {
            bypassReason = 'shadow-update';
        } else if (!targetConfig.supported) {
            bypassReason = targetConfig.reason;
        } else if (!webGlSupported) {
            bypassReason = 'unsupported';
        }

        const signatureParts = [
            [
                drawingBufferSize.x,
                drawingBufferSize.y,
                gl.getPixelRatio(),
                gl.outputColorSpace,
                gl.toneMapping,
                gl.toneMappingExposure,
                qualityKey,
                cloudUniforms.map.value?.uuid ?? 'no-cloud-response',
            ].join(':'),
            buildCameraSignature(camera),
            buildLightingSignature(scene),
            [
                registrySnapshot.revision,
                registrySnapshot.boundarySignature,
            ].join(':'),
            buildBoundaryRuntimeSignature(
                boundaries,
                registrySnapshot.renderables,
            ),
        ] as const;
        const signatureChangeReason = getSignatureChangeReason(
            signaturePartsRef.current,
            signatureParts,
            registrySnapshot.lastInvalidationReason,
        );
        signaturePartsRef.current = signatureParts;
        const signature = signatureParts.join('||');
        inverseViewProjection.multiplyMatrices(
            camera.matrixWorld,
            camera.projectionMatrixInverse,
        );
        const transition = transitionStaticOpaqueSceneCache(
            runtimeRef.current,
            {
                bypassReason,
                enabled,
                signature,
                signatureChangeReason,
                supported,
            },
        );
        runtimeRef.current = transition.runtime;
        const counters = countersRef.current;
        if (transition.invalidated) {
            counters.invalidations += 1;
            counters.lastInvalidationReason = transition.reason;
        }
        const renderLive = () => {
            counters.liveFrames += 1;
            if (
                transition.state === 'bypass' ||
                transition.state === 'unsupported'
            ) {
                counters.bypassFrames += 1;
            }
            renderLiveScene({
                camera,
                gl,
                scene,
            });
        };

        const previousInfoAutoReset = gl.info.autoReset;
        gl.info.autoReset = false;
        gl.info.reset();
        try {
            if (transition.action === 'capture') {
                const capture = captureStaticCloudResponse({
                    boundaries,
                    camera,
                    cloudUniforms,
                    fullResponseMask: cloudFullResponseMask,
                    gl,
                    responseTarget: cloudFullResponseTarget,
                    scene,
                    target,
                });
                counters.replayEstimatedBytes = cacheReplay.estimatedBytes;
                counters.replaySubmissions = cacheReplay.submissionCount;
                counters.replayTriangles = cacheReplay.triangleCount;
                counters.captureSubmissions = capture.submissions;
                counters.captureTriangles = capture.triangles;
                counters.unexpectedStaticSubmissions = Math.max(
                    0,
                    counters.captureSubmissions - boundaryMetrics.submissions,
                );
                const replayStatus = capture.captured
                    ? renderCachedScene({
                          boundaries,
                          camera,
                          gl,
                          replay: cacheReplay,
                          scene,
                      })
                    : 'capture-failed';
                replayStatusRef.current = replayStatus;
                if (capture.captured && replayStatus === 'ready') {
                    counters.captures += 1;
                    counters.compositePasses += 1;
                } else {
                    cachePathSupportedRef.current = false;
                    runtimeRef.current = createStaticOpaqueSceneCacheRuntime();
                    renderLive();
                }
            } else if (transition.action === 'hit') {
                counters.hitFrames += 1;
                counters.compositePasses += 1;
                counters.savedSubmissions += Math.max(
                    0,
                    counters.captureSubmissions - counters.replaySubmissions,
                );
                counters.savedTriangles += Math.max(
                    0,
                    counters.captureTriangles - counters.replayTriangles,
                );
                const replayStatus = renderCachedScene({
                    boundaries,
                    camera,
                    gl,
                    replay: cacheReplay,
                    scene,
                });
                replayStatusRef.current = replayStatus;
                if (replayStatus !== 'ready') {
                    cachePathSupportedRef.current = false;
                    runtimeRef.current = createStaticOpaqueSceneCacheRuntime();
                    renderLive();
                }
            } else {
                renderLive();
            }
        } finally {
            gl.info.autoReset = previousInfoAutoReset;
        }

        updateGameProfileMetadata({
            staticOpaqueSceneCacheBoundaryCount: boundaries.length,
            staticOpaqueSceneCacheBypassFrameCount: counters.bypassFrames,
            staticOpaqueSceneCacheCaptureCount: counters.captures,
            staticOpaqueSceneCacheCaptureSubmissionCount:
                counters.captureSubmissions,
            staticOpaqueSceneCacheCaptureTriangleCount:
                counters.captureTriangles,
            staticOpaqueSceneCacheCompositePassCount: counters.compositePasses,
            staticOpaqueSceneCacheReplayEstimatedBytes:
                counters.replayEstimatedBytes,
            staticOpaqueSceneCacheReplayStatus: replayStatusRef.current,
            staticOpaqueSceneCacheReplaySubmissionCount:
                counters.replaySubmissions,
            staticOpaqueSceneCacheReplayTriangleCount: counters.replayTriangles,
            staticOpaqueSceneCacheEnabled: enabled,
            staticOpaqueSceneCacheHitFrameCount: counters.hitFrames,
            staticOpaqueSceneCacheIneligibleBoundaryCount:
                ineligibleBoundaryCount,
            staticOpaqueSceneCacheInvalidationCount: counters.invalidations,
            staticOpaqueSceneCacheLastInvalidationReason:
                counters.lastInvalidationReason,
            staticOpaqueSceneCacheLiveFrameCount: counters.liveFrames,
            staticOpaqueSceneCacheMeshCount: boundaryMetrics.meshes,
            staticOpaqueSceneCacheReason: capturedStateReason(
                transition.reason,
                cachePathSupportedRef.current,
            ),
            staticOpaqueSceneCacheSavedSubmissionCount:
                counters.savedSubmissions,
            staticOpaqueSceneCacheSavedTriangleCount: counters.savedTriangles,
            staticOpaqueSceneCacheState: !cachePathSupportedRef.current
                ? 'unsupported'
                : transition.action === 'capture'
                  ? 'capturing'
                  : transition.state,
            staticOpaqueSceneCacheSupported:
                supported && cachePathSupportedRef.current,
            staticOpaqueSceneCacheTargetEstimatedBytes:
                targetConfig.estimatedBytes,
            staticOpaqueSceneCacheTargetHeight: targetConfig.height,
            staticOpaqueSceneCacheTargetSampleCount: target.samples,
            staticOpaqueSceneCacheTargetWidth: targetConfig.width,
            staticOpaqueSceneCacheTriangleCount: boundaryMetrics.triangles,
            staticOpaqueSceneCacheUnexpectedStaticSubmissionCount:
                counters.unexpectedStaticSubmissions,
        });
    }, 1);

    return null;
}

function capturedStateReason(
    reason: StaticOpaqueSceneCacheReason,
    framebufferSupported: boolean,
) {
    return framebufferSupported ? reason : 'unsupported';
}

export function StaticOpaqueSceneCacheProvider({
    children,
    enabled,
    interactionActive,
    qualityKey,
    wireframe,
}: PropsWithChildren<{
    enabled: boolean;
    interactionActive: boolean;
    qualityKey: string;
    wireframe: boolean;
}>) {
    const requestRender = useSceneRenderRequest();
    const registry = useMemo(
        () =>
            new StaticOpaqueSceneCacheRegistry(() =>
                requestRender('static-opaque-cache'),
            ),
        [requestRender],
    );

    useEffect(() => {
        if (enabled) {
            return;
        }
        updateGameProfileMetadata({
            staticOpaqueSceneCacheBoundaryCount: 0,
            staticOpaqueSceneCacheBypassFrameCount: 0,
            staticOpaqueSceneCacheCaptureCount: 0,
            staticOpaqueSceneCacheCaptureSubmissionCount: 0,
            staticOpaqueSceneCacheCaptureTriangleCount: 0,
            staticOpaqueSceneCacheCompositePassCount: 0,
            staticOpaqueSceneCacheReplayEstimatedBytes: 0,
            staticOpaqueSceneCacheReplayStatus: 'disabled',
            staticOpaqueSceneCacheReplaySubmissionCount: 0,
            staticOpaqueSceneCacheReplayTriangleCount: 0,
            staticOpaqueSceneCacheEnabled: false,
            staticOpaqueSceneCacheHitFrameCount: 0,
            staticOpaqueSceneCacheIneligibleBoundaryCount: 0,
            staticOpaqueSceneCacheInvalidationCount: 0,
            staticOpaqueSceneCacheLastInvalidationReason: 'disabled',
            staticOpaqueSceneCacheLiveFrameCount: 0,
            staticOpaqueSceneCacheMeshCount: 0,
            staticOpaqueSceneCacheReason: 'disabled',
            staticOpaqueSceneCacheSavedSubmissionCount: 0,
            staticOpaqueSceneCacheSavedTriangleCount: 0,
            staticOpaqueSceneCacheState: 'disabled',
            staticOpaqueSceneCacheSupported: false,
            staticOpaqueSceneCacheTargetEstimatedBytes: 0,
            staticOpaqueSceneCacheTargetHeight: 0,
            staticOpaqueSceneCacheTargetSampleCount: 0,
            staticOpaqueSceneCacheTargetWidth: 0,
            staticOpaqueSceneCacheTriangleCount: 0,
            staticOpaqueSceneCacheUnexpectedStaticSubmissionCount: 0,
        });
    }, [enabled]);

    return (
        <StaticOpaqueSceneCacheContext.Provider value={registry}>
            {children}
            {enabled && (
                <StaticOpaqueSceneCacheRenderer
                    enabled
                    interactionActive={interactionActive}
                    qualityKey={qualityKey}
                    registry={registry}
                    wireframe={wireframe}
                />
            )}
        </StaticOpaqueSceneCacheContext.Provider>
    );
}
