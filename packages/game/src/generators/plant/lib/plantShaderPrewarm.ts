import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import {
    createRaisedBedPlantShadowProxyGeometry,
    createRaisedBedPlantShadowProxyMaterial,
} from '../../../entities/raisedBed/plantShadowProxy';
import { plantSwayVertexShader } from '../hooks/usePlantSway';
import {
    billboardFragmentShader,
    billboardVertexShader,
} from '../parts/PlantBillboard';
import {
    instancedStemSurfaceVertexShader,
    stemSurfaceFragmentShader,
} from './plant-stem-material';
import {
    leafColorFragmentShader,
    leafColorVertexShader,
} from './plantLeafMaterial';
import {
    createPlantStemGeometryShell,
    disposePlantStemGeometryShell,
} from './plantStemGeometry';

export const GENERATED_PLANT_SHADER_PREWARM_COMPILE_TIMEOUT_MS = 4_000;

export const generatedPlantShaderPrewarmVariants = [
    'stem',
    'leaf',
    'flower',
    'standard-sway',
    'billboard',
    'shadow-proxy',
] as const;

export const generatedPlantInstancedSwayShaderPrewarmVariants = [
    'stem',
    'leaf',
    'flower',
    'standard-sway',
] as const;

export type GeneratedPlantShaderPrewarmCompletionStatus =
    | 'cancelled'
    | 'failed'
    | 'ready'
    | 'timed-out';

export type GeneratedPlantShaderPrewarmFailureReason =
    | 'aborted'
    | 'compile-rejected'
    | 'context-lost'
    | 'resource-creation-failed'
    | 'timeout';

export interface GeneratedPlantShaderPrewarmResult {
    deduplicated: boolean;
    durationMs: number;
    reason: GeneratedPlantShaderPrewarmFailureReason | null;
    status: GeneratedPlantShaderPrewarmCompletionStatus;
    variantKey: string;
}

export interface GeneratedPlantShaderPrewarmRequest {
    completion: Promise<GeneratedPlantShaderPrewarmResult>;
    deduplicated: boolean;
}

export interface GeneratedPlantShaderPrewarmResources {
    dispose: () => void;
    root: THREE.Group;
}

export interface GeneratedPlantShaderCompiler {
    compileAsync: (
        object: THREE.Object3D,
        camera: THREE.Camera,
        targetScene: THREE.Scene,
    ) => Promise<unknown>;
    isContextLost: () => boolean;
}

interface GeneratedPlantShaderPrewarmOptions {
    camera: THREE.Camera;
    compiler: GeneratedPlantShaderCompiler;
    retainReadyResources?: (
        resources: GeneratedPlantShaderPrewarmResources,
    ) => void;
    scene: THREE.Scene;
    timeoutMs?: number;
    variantKey: string;
}

interface RequestGeneratedPlantShaderPrewarmOptions
    extends GeneratedPlantShaderPrewarmOptions {
    renderer: object;
    signal?: AbortSignal;
}

type GeneratedPlantShaderPrewarmOutcome = Pick<
    GeneratedPlantShaderPrewarmResult,
    'reason' | 'status'
>;

interface GeneratedPlantShaderPrewarmCacheEntry {
    completion: Promise<GeneratedPlantShaderPrewarmResult>;
    invalidate: () => void;
}

const prewarmRequestsByRenderer = new WeakMap<
    object,
    Map<string, GeneratedPlantShaderPrewarmCacheEntry>
>();

function now() {
    return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function elapsedSince(startedAt: number) {
    return Math.max(0, now() - startedAt);
}

function validateTimeout(timeoutMs: number) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new RangeError(
            'Generated plant shader prewarm timeout must be a positive finite number.',
        );
    }
}

function isContextLost(compiler: GeneratedPlantShaderCompiler) {
    try {
        return compiler.isContextLost();
    } catch {
        return true;
    }
}

function createSwayUniforms() {
    return {
        uTime: { value: 0 },
        uSwayAmplitude: { value: 0.1 },
        uSwaySpeed: { value: 1 },
        uSwayPhase: { value: 0 },
        uWindStrength: { value: 0 },
        uWindDirection: { value: [1, 0] },
    };
}

function initializeWarmupMesh(
    mesh: THREE.InstancedMesh,
    { usesSway = false }: { usesSway?: boolean } = {},
) {
    mesh.setMatrixAt(0, new THREE.Matrix4());
    mesh.instanceMatrix.needsUpdate = true;
    if (usesSway) {
        mesh.geometry.setAttribute(
            'instanceSwayPhase',
            new THREE.InstancedBufferAttribute(new Float32Array([0]), 1),
        );
    }
    return mesh;
}

export function createGeneratedPlantShaderPrewarmResources(): GeneratedPlantShaderPrewarmResources {
    const root = new THREE.Group();
    root.name = 'GeneratedPlantShaderPrewarm';

    const stemGeometry = createPlantStemGeometryShell();
    stemGeometry.setAttribute(
        'stemRadius',
        new THREE.InstancedBufferAttribute(new Float32Array([0.08, 0.04]), 2),
    );
    const stemMaterial = new CustomShaderMaterial({
        baseMaterial: THREE.MeshStandardMaterial,
        vertexShader: instancedStemSurfaceVertexShader,
        fragmentShader: stemSurfaceFragmentShader,
        uniforms: {
            ...createSwayUniforms(),
            uStemDetailColor: { value: new THREE.Color('#31592f') },
            uStemDetailScale: { value: 1 },
            uStemDetailStrength: { value: 0.3 },
        },
        color: '#4c7a3f',
        roughness: 0.8,
        metalness: 0.2,
    });
    const stem = initializeWarmupMesh(
        new THREE.InstancedMesh(stemGeometry, stemMaterial, 1),
        { usesSway: true },
    );
    stem.name = 'GeneratedPlantShaderPrewarm:stem';

    const leafGeometry = new THREE.PlaneGeometry(1, 1);
    leafGeometry.setAttribute(
        'leafInstanceColor',
        new THREE.InstancedBufferAttribute(
            new Float32Array([0.3, 0.6, 0.2]),
            3,
        ),
    );
    const leafMaterial = new CustomShaderMaterial({
        baseMaterial: THREE.MeshStandardMaterial,
        vertexShader: leafColorVertexShader,
        fragmentShader: leafColorFragmentShader,
        uniforms: createSwayUniforms(),
        color: '#ffffff',
        side: THREE.DoubleSide,
        roughness: 0.6,
    });
    const leaf = initializeWarmupMesh(
        new THREE.InstancedMesh(leafGeometry, leafMaterial, 1),
        { usesSway: true },
    );
    leaf.name = 'GeneratedPlantShaderPrewarm:leaf';

    const flowerGeometry = new THREE.CircleGeometry(1, 5);
    const flowerMaterial = new CustomShaderMaterial({
        baseMaterial: THREE.MeshBasicMaterial,
        vertexShader: plantSwayVertexShader,
        uniforms: createSwayUniforms(),
        color: '#ffffff',
        side: THREE.DoubleSide,
    });
    const flower = initializeWarmupMesh(
        new THREE.InstancedMesh(flowerGeometry, flowerMaterial, 1),
        { usesSway: true },
    );
    flower.name = 'GeneratedPlantShaderPrewarm:flower';

    const standardSwayGeometry = new THREE.ConeGeometry(0.5, 1, 6);
    const standardSwayMaterial = new CustomShaderMaterial({
        baseMaterial: THREE.MeshStandardMaterial,
        vertexShader: plantSwayVertexShader,
        uniforms: createSwayUniforms(),
        color: '#ffffff',
        roughness: 0.7,
    });
    const standardSway = initializeWarmupMesh(
        new THREE.InstancedMesh(standardSwayGeometry, standardSwayMaterial, 1),
        { usesSway: true },
    );
    standardSway.name = 'GeneratedPlantShaderPrewarm:standard-sway';

    const billboardGeometry = new THREE.PlaneGeometry(1, 1);
    billboardGeometry.setAttribute(
        'instanceTint',
        new THREE.InstancedBufferAttribute(
            new Float32Array([0.3, 0.6, 0.2]),
            3,
        ),
    );
    const billboardMaterial = new THREE.ShaderMaterial({
        depthWrite: false,
        fragmentShader: billboardFragmentShader,
        transparent: true,
        uniforms: {
            uOpacity: { value: 0.9 },
        },
        vertexShader: billboardVertexShader,
    });
    const billboard = initializeWarmupMesh(
        new THREE.InstancedMesh(billboardGeometry, billboardMaterial, 1),
    );
    billboard.name = 'GeneratedPlantShaderPrewarm:billboard';

    const shadowProxyGeometry = createRaisedBedPlantShadowProxyGeometry();
    const shadowProxyColorMaterial = createRaisedBedPlantShadowProxyMaterial();
    const shadowProxyDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.BasicDepthPacking,
    });
    const shadowProxy = initializeWarmupMesh(
        new THREE.InstancedMesh(
            shadowProxyGeometry,
            [shadowProxyColorMaterial, shadowProxyDepthMaterial],
            1,
        ),
    );
    shadowProxy.castShadow = true;
    shadowProxy.name = 'GeneratedPlantShaderPrewarm:shadow-proxy';

    root.add(stem, leaf, flower, standardSway, billboard, shadowProxy);

    let disposed = false;
    return {
        root,
        dispose: () => {
            if (disposed) {
                return;
            }
            disposed = true;

            root.clear();
            disposePlantStemGeometryShell(stemGeometry);
            leafGeometry.dispose();
            flowerGeometry.dispose();
            standardSwayGeometry.dispose();
            billboardGeometry.dispose();
            shadowProxyGeometry.dispose();
            stemMaterial.dispose();
            leafMaterial.dispose();
            flowerMaterial.dispose();
            standardSwayMaterial.dispose();
            billboardMaterial.dispose();
            shadowProxyColorMaterial.dispose();
            shadowProxyDepthMaterial.dispose();
        },
    };
}

function createResult({
    deduplicated = false,
    outcome,
    startedAt,
    variantKey,
}: {
    deduplicated?: boolean;
    outcome: GeneratedPlantShaderPrewarmOutcome;
    startedAt: number;
    variantKey: string;
}): GeneratedPlantShaderPrewarmResult {
    return {
        deduplicated,
        durationMs: elapsedSince(startedAt),
        reason: outcome.reason,
        status: outcome.status,
        variantKey,
    };
}

/**
 * Compiles every generated-plant program variant and owns the temporary
 * resources until the renderer has finished touching them. A timeout bounds
 * the caller-visible wait; late compiler settlement still performs cleanup.
 */
export async function prewarmGeneratedPlantShaders({
    camera,
    compiler,
    retainReadyResources,
    scene,
    timeoutMs = GENERATED_PLANT_SHADER_PREWARM_COMPILE_TIMEOUT_MS,
    variantKey,
}: GeneratedPlantShaderPrewarmOptions): Promise<GeneratedPlantShaderPrewarmResult> {
    validateTimeout(timeoutMs);
    const startedAt = now();

    if (isContextLost(compiler)) {
        return createResult({
            outcome: {
                reason: 'context-lost',
                status: 'failed',
            },
            startedAt,
            variantKey,
        });
    }

    let resources: GeneratedPlantShaderPrewarmResources;
    try {
        resources = createGeneratedPlantShaderPrewarmResources();
    } catch {
        return createResult({
            outcome: {
                reason: 'resource-creation-failed',
                status: 'failed',
            },
            startedAt,
            variantKey,
        });
    }
    resources.root.name = `GeneratedPlantShaderPrewarm:${variantKey}`;

    const compileOutcome = Promise.resolve()
        .then(() => compiler.compileAsync(resources.root, camera, scene))
        .then(
            (): GeneratedPlantShaderPrewarmOutcome =>
                isContextLost(compiler)
                    ? {
                          reason: 'context-lost',
                          status: 'failed',
                      }
                    : {
                          reason: null,
                          status: 'ready',
                      },
            (): GeneratedPlantShaderPrewarmOutcome => ({
                reason: 'compile-rejected',
                status: 'failed',
            }),
        );
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutOutcome = new Promise<GeneratedPlantShaderPrewarmOutcome>(
        (resolve) => {
            timeoutId = setTimeout(() => {
                resolve({
                    reason: 'timeout',
                    status: 'timed-out',
                });
            }, timeoutMs);
        },
    );
    const outcome = await Promise.race([compileOutcome, timeoutOutcome]);
    if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
    }

    if (outcome.status === 'timed-out') {
        void compileOutcome.then(() => {
            resources.dispose();
        });
    } else if (outcome.status === 'ready' && retainReadyResources) {
        retainReadyResources(resources);
    } else {
        resources.dispose();
    }

    return createResult({
        outcome,
        startedAt,
        variantKey,
    });
}

function subscribeToPrewarmCompletion({
    completion,
    deduplicated,
    signal,
    variantKey,
}: {
    completion: Promise<GeneratedPlantShaderPrewarmResult>;
    deduplicated: boolean;
    signal?: AbortSignal;
    variantKey: string;
}) {
    const startedAt = now();
    const decorate = (
        result: GeneratedPlantShaderPrewarmResult,
    ): GeneratedPlantShaderPrewarmResult => ({
        ...result,
        deduplicated,
        durationMs: deduplicated ? elapsedSince(startedAt) : result.durationMs,
    });

    if (!signal) {
        return completion.then(decorate);
    }
    if (signal.aborted) {
        return Promise.resolve(
            createResult({
                deduplicated,
                outcome: {
                    reason: 'aborted',
                    status: 'cancelled',
                },
                startedAt,
                variantKey,
            }),
        );
    }

    return new Promise<GeneratedPlantShaderPrewarmResult>((resolve) => {
        let settled = false;
        const finish = (result: GeneratedPlantShaderPrewarmResult) => {
            if (settled) {
                return;
            }
            settled = true;
            signal.removeEventListener('abort', handleAbort);
            resolve(result);
        };
        const handleAbort = () => {
            finish(
                createResult({
                    deduplicated,
                    outcome: {
                        reason: 'aborted',
                        status: 'cancelled',
                    },
                    startedAt,
                    variantKey,
                }),
            );
        };

        signal.addEventListener('abort', handleAbort, { once: true });
        void completion.then((result) => {
            finish(decorate(result));
        });
    });
}

/**
 * Shares one warmup per WebGL renderer and quality/shader variant. Successful
 * results remain cached because Three.js retains the compiled programs.
 * Failed or timed-out attempts are evicted so a later mount can retry.
 */
export function requestGeneratedPlantShaderPrewarm({
    camera,
    compiler,
    renderer,
    scene,
    signal,
    timeoutMs,
    variantKey,
}: RequestGeneratedPlantShaderPrewarmOptions): GeneratedPlantShaderPrewarmRequest {
    const resolvedTimeoutMs =
        timeoutMs ?? GENERATED_PLANT_SHADER_PREWARM_COMPILE_TIMEOUT_MS;
    validateTimeout(resolvedTimeoutMs);

    let rendererRequests = prewarmRequestsByRenderer.get(renderer);
    if (!rendererRequests) {
        rendererRequests = new Map();
        prewarmRequestsByRenderer.set(renderer, rendererRequests);
    }

    const existingEntry = rendererRequests.get(variantKey);
    const deduplicated = existingEntry !== undefined;
    let sharedEntry = existingEntry;
    if (!sharedEntry) {
        let invalidated = false;
        let retainedResources: GeneratedPlantShaderPrewarmResources | null =
            null;
        const completion = prewarmGeneratedPlantShaders({
            camera,
            compiler,
            retainReadyResources: (resources) => {
                if (invalidated) {
                    resources.dispose();
                    return;
                }

                retainedResources = resources;
            },
            scene,
            timeoutMs: resolvedTimeoutMs,
            variantKey,
        });
        sharedEntry = {
            completion,
            invalidate: () => {
                invalidated = true;
                retainedResources?.dispose();
                retainedResources = null;
            },
        };
        rendererRequests.set(variantKey, sharedEntry);

        const createdEntry = sharedEntry;
        void completion.then((result) => {
            if (
                result.status !== 'ready' &&
                rendererRequests?.get(variantKey) === createdEntry
            ) {
                createdEntry.invalidate();
                rendererRequests.delete(variantKey);
                if (rendererRequests.size === 0) {
                    prewarmRequestsByRenderer.delete(renderer);
                }
            }
        });
    }

    return {
        completion: subscribeToPrewarmCompletion({
            completion: sharedEntry.completion,
            deduplicated,
            signal,
            variantKey,
        }),
        deduplicated,
    };
}

export function invalidateGeneratedPlantShaderPrewarm(
    renderer: object,
    variantKey?: string,
) {
    const rendererRequests = prewarmRequestsByRenderer.get(renderer);
    if (!rendererRequests) {
        return;
    }

    if (variantKey === undefined) {
        for (const entry of rendererRequests.values()) {
            entry.invalidate();
        }
        prewarmRequestsByRenderer.delete(renderer);
        return;
    }

    rendererRequests.get(variantKey)?.invalidate();
    rendererRequests.delete(variantKey);
    if (rendererRequests.size === 0) {
        prewarmRequestsByRenderer.delete(renderer);
    }
}

export function subscribeToGeneratedPlantShaderPrewarmContextRecovery({
    eventTarget,
    onContextLost,
    onContextRestored,
    renderer,
}: {
    eventTarget: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
    onContextLost: () => void;
    onContextRestored: () => void;
    renderer: object;
}) {
    const handleContextLost = () => {
        invalidateGeneratedPlantShaderPrewarm(renderer);
        onContextLost();
    };
    const handleContextRestored = () => {
        onContextRestored();
    };

    eventTarget.addEventListener('webglcontextlost', handleContextLost);
    eventTarget.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
        eventTarget.removeEventListener('webglcontextlost', handleContextLost);
        eventTarget.removeEventListener(
            'webglcontextrestored',
            handleContextRestored,
        );
    };
}
