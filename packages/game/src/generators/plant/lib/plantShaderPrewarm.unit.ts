import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
    createGeneratedPlantShaderPrewarmResources,
    generatedPlantInstancedSwayShaderPrewarmVariants,
    generatedPlantShaderPrewarmVariants,
    invalidateGeneratedPlantShaderPrewarm,
    prewarmGeneratedPlantShaders,
    requestGeneratedPlantShaderPrewarm,
    subscribeToGeneratedPlantShaderPrewarmContextRecovery,
} from './plantShaderPrewarm';

function createDeferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((resolvePromise) => {
        resolve = resolvePromise;
    });

    return { promise, resolve };
}

function getInstancedMeshes(root: THREE.Object3D) {
    const meshes: THREE.InstancedMesh[] = [];
    root.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) {
            meshes.push(object);
        }
    });
    return meshes;
}

function getVariantName(mesh: THREE.InstancedMesh) {
    return mesh.name.replace('GeneratedPlantShaderPrewarm:', '');
}

describe('generated plant shader prewarm', () => {
    it('provides a complete representative set with required instanced attributes', () => {
        const resources = createGeneratedPlantShaderPrewarmResources();
        const meshes = getInstancedMeshes(resources.root);

        assert.deepEqual(
            meshes.map(getVariantName),
            generatedPlantShaderPrewarmVariants,
        );
        assert.ok(meshes.every((mesh) => mesh.count === 1));

        const meshesByVariant = new Map(
            meshes.map((mesh) => [getVariantName(mesh), mesh]),
        );
        assert.ok(
            meshesByVariant.get('stem')?.geometry.hasAttribute('stemRadius'),
        );
        assert.ok(
            meshesByVariant
                .get('leaf')
                ?.geometry.hasAttribute('leafInstanceColor'),
        );
        for (const variant of generatedPlantInstancedSwayShaderPrewarmVariants) {
            assert.ok(
                meshesByVariant
                    .get(variant)
                    ?.geometry.hasAttribute('instanceSwayPhase'),
                `${variant} must provide instanceSwayPhase`,
            );
        }

        const billboard = meshesByVariant.get('billboard');
        assert.ok(billboard?.geometry.hasAttribute('instanceTint'));
        assert.ok(billboard?.material instanceof THREE.ShaderMaterial);
        assert.equal(billboard.material.transparent, true);
        assert.equal(billboard.material.depthWrite, false);

        const shadowProxy = meshesByVariant.get('shadow-proxy');
        assert.ok(shadowProxy);
        assert.equal(shadowProxy.castShadow, true);
        assert.ok(Array.isArray(shadowProxy.material));
        assert.ok(
            shadowProxy.material.some(
                (material) => material instanceof THREE.MeshBasicMaterial,
            ),
        );
        assert.ok(
            shadowProxy.material.some(
                (material) => material instanceof THREE.MeshDepthMaterial,
            ),
        );

        resources.dispose();
        resources.dispose();
        assert.equal(resources.root.children.length, 0);
    });

    it('compiles the off-scene warmup root and returns a structured ready result', async () => {
        const camera = new THREE.OrthographicCamera();
        const scene = new THREE.Scene();
        const calls: Array<{
            camera: THREE.Camera;
            object: THREE.Object3D;
            scene: THREE.Scene;
        }> = [];

        const result = await prewarmGeneratedPlantShaders({
            camera,
            compiler: {
                compileAsync: (object, compileCamera, targetScene) => {
                    calls.push({
                        camera: compileCamera,
                        object,
                        scene: targetScene,
                    });
                    return Promise.resolve(object);
                },
                isContextLost: () => false,
            },
            scene,
            variantKey: 'shadows',
        });

        assert.equal(result.status, 'ready');
        assert.equal(result.reason, null);
        assert.equal(result.variantKey, 'shadows');
        assert.equal(result.deduplicated, false);
        assert.ok(result.durationMs >= 0);
        assert.equal(calls.length, 1);
        assert.equal(calls[0]?.camera, camera);
        assert.equal(calls[0]?.scene, scene);
        assert.equal(
            calls[0]?.object.name,
            'GeneratedPlantShaderPrewarm:shadows',
        );
        assert.equal(calls[0]?.object.children.length, 0);
    });

    it('reports context loss before and after compilation without throwing', async () => {
        let compileCount = 0;
        const beforeResult = await prewarmGeneratedPlantShaders({
            camera: new THREE.OrthographicCamera(),
            compiler: {
                compileAsync: (object) => {
                    compileCount += 1;
                    return Promise.resolve(object);
                },
                isContextLost: () => true,
            },
            scene: new THREE.Scene(),
            variantKey: 'before-context-loss',
        });

        assert.equal(beforeResult.status, 'failed');
        assert.equal(beforeResult.reason, 'context-lost');
        assert.equal(compileCount, 0);

        let contextLost = false;
        const afterResult = await prewarmGeneratedPlantShaders({
            camera: new THREE.OrthographicCamera(),
            compiler: {
                compileAsync: (object) => {
                    compileCount += 1;
                    contextLost = true;
                    return Promise.resolve(object);
                },
                isContextLost: () => contextLost,
            },
            scene: new THREE.Scene(),
            variantKey: 'after-context-loss',
        });

        assert.equal(afterResult.status, 'failed');
        assert.equal(afterResult.reason, 'context-lost');
        assert.equal(compileCount, 1);
    });

    it('turns compileAsync rejection into a failed result and disposes resources', async () => {
        let compiledRoot: THREE.Object3D | undefined;
        const result = await prewarmGeneratedPlantShaders({
            camera: new THREE.OrthographicCamera(),
            compiler: {
                compileAsync: (object) => {
                    compiledRoot = object;
                    return Promise.reject(new Error('compile failed'));
                },
                isContextLost: () => false,
            },
            scene: new THREE.Scene(),
            variantKey: 'rejection',
        });

        assert.equal(result.status, 'failed');
        assert.equal(result.reason, 'compile-rejected');
        assert.equal(compiledRoot?.children.length, 0);
    });

    it('bounds the wait and defers disposal until a late compiler settles', async () => {
        const deferred = createDeferred();
        let compiledRoot: THREE.Object3D | undefined;
        const result = await prewarmGeneratedPlantShaders({
            camera: new THREE.OrthographicCamera(),
            compiler: {
                compileAsync: (object) => {
                    compiledRoot = object;
                    return deferred.promise;
                },
                isContextLost: () => false,
            },
            scene: new THREE.Scene(),
            timeoutMs: 5,
            variantKey: 'timeout',
        });

        assert.equal(result.status, 'timed-out');
        assert.equal(result.reason, 'timeout');
        assert.ok((compiledRoot?.children.length ?? 0) > 0);

        deferred.resolve();
        await deferred.promise;
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });
        assert.equal(compiledRoot?.children.length, 0);
    });

    it('deduplicates by renderer and variant key while retaining successful results', async () => {
        const deferred = createDeferred();
        const renderer = {};
        const camera = new THREE.OrthographicCamera();
        const scene = new THREE.Scene();
        let compileCount = 0;
        const compiler = {
            compileAsync: () => {
                compileCount += 1;
                return deferred.promise;
            },
            isContextLost: () => false,
        };

        const first = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler,
            renderer,
            scene,
            variantKey: 'shadows',
        });
        const duplicate = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler,
            renderer,
            scene,
            variantKey: 'shadows',
        });

        assert.equal(first.deduplicated, false);
        assert.equal(duplicate.deduplicated, true);
        await Promise.resolve();
        assert.equal(compileCount, 1);

        deferred.resolve();
        const [firstResult, duplicateResult] = await Promise.all([
            first.completion,
            duplicate.completion,
        ]);
        assert.equal(firstResult.status, 'ready');
        assert.equal(firstResult.deduplicated, false);
        assert.equal(duplicateResult.status, 'ready');
        assert.equal(duplicateResult.deduplicated, true);

        const cached = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler,
            renderer,
            scene,
            variantKey: 'shadows',
        });
        assert.equal(cached.deduplicated, true);
        assert.equal((await cached.completion).status, 'ready');
        assert.equal(compileCount, 1);

        const otherVariant = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler: {
                compileAsync: () => {
                    compileCount += 1;
                    return Promise.resolve();
                },
                isContextLost: () => false,
            },
            renderer,
            scene,
            variantKey: 'without-shadows',
        });
        assert.equal(otherVariant.deduplicated, false);
        assert.equal((await otherVariant.completion).status, 'ready');
        assert.equal(compileCount, 2);

        invalidateGeneratedPlantShaderPrewarm(renderer, 'shadows');
        const afterInvalidation = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler: {
                compileAsync: () => {
                    compileCount += 1;
                    return Promise.resolve();
                },
                isContextLost: () => false,
            },
            renderer,
            scene,
            variantKey: 'shadows',
        });
        assert.equal(afterInvalidation.deduplicated, false);
        assert.equal((await afterInvalidation.completion).status, 'ready');
        assert.equal(compileCount, 3);
    });

    it('retains ready resources until the renderer variant is invalidated', async () => {
        const renderer = {};
        let compiledRoot: THREE.Object3D | undefined;
        const request = requestGeneratedPlantShaderPrewarm({
            camera: new THREE.OrthographicCamera(),
            compiler: {
                compileAsync: (object) => {
                    compiledRoot = object;
                    return Promise.resolve();
                },
                isContextLost: () => false,
            },
            renderer,
            scene: new THREE.Scene(),
            variantKey: 'retained-programs',
        });

        assert.equal((await request.completion).status, 'ready');
        assert.ok((compiledRoot?.children.length ?? 0) > 0);

        invalidateGeneratedPlantShaderPrewarm(renderer, 'retained-programs');
        assert.equal(compiledRoot?.children.length, 0);
    });

    it('invalidates every renderer variant on context loss and requests recovery after restoration', async () => {
        const renderer = {};
        const camera = new THREE.OrthographicCamera();
        const scene = new THREE.Scene();
        const eventTarget = new EventTarget();
        const compiledRoots: THREE.Object3D[] = [];
        let compileCount = 0;
        const compiler = {
            compileAsync: (object: THREE.Object3D) => {
                compileCount += 1;
                compiledRoots.push(object);
                return Promise.resolve();
            },
            isContextLost: () => false,
        };
        const requestVariant = (variantKey: string) =>
            requestGeneratedPlantShaderPrewarm({
                camera,
                compiler,
                renderer,
                scene,
                variantKey,
            });

        await Promise.all([
            requestVariant('shadows').completion,
            requestVariant('without-shadows').completion,
        ]);
        assert.equal(compileCount, 2);
        assert.ok(compiledRoots.every((root) => root.children.length > 0));

        let contextLostCount = 0;
        const restoredRequests: Array<
            ReturnType<typeof requestGeneratedPlantShaderPrewarm>
        > = [];
        const unsubscribe =
            subscribeToGeneratedPlantShaderPrewarmContextRecovery({
                eventTarget,
                onContextLost: () => {
                    contextLostCount += 1;
                },
                onContextRestored: () => {
                    restoredRequests.push(requestVariant('shadows'));
                },
                renderer,
            });

        eventTarget.dispatchEvent(new Event('webglcontextlost'));
        assert.equal(contextLostCount, 1);
        assert.ok(compiledRoots.every((root) => root.children.length === 0));

        eventTarget.dispatchEvent(new Event('webglcontextrestored'));
        const restoredRequest = restoredRequests[0];
        assert.ok(restoredRequest);
        assert.equal(restoredRequest.deduplicated, false);
        assert.equal((await restoredRequest.completion).status, 'ready');
        assert.equal(compileCount, 3);

        const alternateAfterRestore = requestVariant('without-shadows');
        assert.equal(alternateAfterRestore.deduplicated, false);
        assert.equal((await alternateAfterRestore.completion).status, 'ready');
        assert.equal(compileCount, 4);

        unsubscribe();
        eventTarget.dispatchEvent(new Event('webglcontextrestored'));
        assert.equal(restoredRequests.length, 1);
        assert.equal(compileCount, 4);
        invalidateGeneratedPlantShaderPrewarm(renderer);
    });

    it('evicts failed shared attempts so a later mount can retry', async () => {
        const renderer = {};
        const camera = new THREE.OrthographicCamera();
        const scene = new THREE.Scene();
        let compileCount = 0;
        let rejectCompilation = true;
        const compiler = {
            compileAsync: () => {
                compileCount += 1;
                return rejectCompilation
                    ? Promise.reject(new Error('compile failed'))
                    : Promise.resolve();
            },
            isContextLost: () => false,
        };

        const failed = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler,
            renderer,
            scene,
            variantKey: 'retry',
        });
        assert.equal((await failed.completion).status, 'failed');

        rejectCompilation = false;
        const retry = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler,
            renderer,
            scene,
            variantKey: 'retry',
        });
        assert.equal(retry.deduplicated, false);
        assert.equal((await retry.completion).status, 'ready');
        assert.equal(compileCount, 2);
    });

    it('cancels one subscriber without interrupting shared compilation or cleanup', async () => {
        const deferred = createDeferred();
        const controller = new AbortController();
        const renderer = {};
        const camera = new THREE.OrthographicCamera();
        const scene = new THREE.Scene();
        let compileCount = 0;
        let compiledRoot: THREE.Object3D | undefined;
        const compiler = {
            compileAsync: (object: THREE.Object3D) => {
                compileCount += 1;
                compiledRoot = object;
                return deferred.promise;
            },
            isContextLost: () => false,
        };

        const cancellable = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler,
            renderer,
            scene,
            signal: controller.signal,
            variantKey: 'cancel-one',
        });
        const remaining = requestGeneratedPlantShaderPrewarm({
            camera,
            compiler,
            renderer,
            scene,
            variantKey: 'cancel-one',
        });
        controller.abort();

        const cancelledResult = await cancellable.completion;
        assert.equal(cancelledResult.status, 'cancelled');
        assert.equal(cancelledResult.reason, 'aborted');
        assert.equal(compileCount, 1);
        deferred.resolve();
        assert.equal((await remaining.completion).status, 'ready');
        assert.ok((compiledRoot?.children.length ?? 0) > 0);
        invalidateGeneratedPlantShaderPrewarm(renderer, 'cancel-one');
        assert.equal(compiledRoot?.children.length, 0);
    });

    it('rejects invalid timeout configuration before scheduling work', async () => {
        await assert.rejects(
            prewarmGeneratedPlantShaders({
                camera: new THREE.OrthographicCamera(),
                compiler: {
                    compileAsync: () => Promise.resolve(),
                    isContextLost: () => false,
                },
                scene: new THREE.Scene(),
                timeoutMs: 0,
                variantKey: 'invalid-timeout',
            }),
            RangeError,
        );
    });
});
