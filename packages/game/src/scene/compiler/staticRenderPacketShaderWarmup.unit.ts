import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
    BatchedMesh,
    BoxGeometry,
    DirectionalLight,
    Float32BufferAttribute,
    Group,
    InstancedMesh,
    Mesh,
    MeshStandardMaterial,
    NoToneMapping,
    type Object3D,
    OrthographicCamera,
    PCFShadowMap,
    Scene,
    SkinnedMesh,
    SpotLight,
    SRGBColorSpace,
    Texture,
    WebGLRenderTarget,
} from 'three';
import {
    compileStaticPacketShaders,
    type StaticPacketShaderCompile,
    type StaticPacketShaderRenderer,
    StaticRenderPacketShaderWarmup,
    staticPacketPresentationPreparation,
    staticPacketShaderSceneKey,
    staticPacketShaderWarmupLimits,
    supportsStaticPacketShaderWarmup,
} from './staticRenderPacketShaderWarmup';

const originalProgramDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'WebGLProgram',
);
class NativeProgram {}
before(() =>
    Object.defineProperty(globalThis, 'WebGLProgram', {
        configurable: true,
        value: NativeProgram,
    }),
);
after(() => {
    if (originalProgramDescriptor)
        Object.defineProperty(
            globalThis,
            'WebGLProgram',
            originalProgramDescriptor,
        );
    else Reflect.deleteProperty(globalThis, 'WebGLProgram');
});

function deferred() {
    let resolve: (value: boolean) => void = () => {};
    const completion = new Promise<boolean>((complete) => {
        resolve = complete;
    });
    return { completion, resolve };
}

function rendererFixture() {
    const properties = new Map<
        unknown,
        { currentProgram: unknown; programs: Map<string, unknown> }
    >();
    const programs = new Map<
        string,
        {
            cacheKey: string;
            program: NativeProgram;
            isReady: () => boolean;
            getUniforms: () => void;
        }
    >();
    const calls: { object: Object3D; temporary: boolean }[] = [];
    let lost = false;
    let linked = true;
    let changedActualProgram = false;
    let diagnostics = 0;
    const initialize = (object: Object3D, temporary: boolean) => {
        object.traverse((child) => {
            if (!(child instanceof Mesh) || Array.isArray(child.material))
                return;
            const material = child.material;
            const key = `${material.customProgramCacheKey()}|${child instanceof InstancedMesh}|${child.receiveShadow}`;
            let program = programs.get(key);
            if (!program) {
                program = {
                    cacheKey: key,
                    program: new NativeProgram(),
                    isReady: () => true,
                    getUniforms: () => {
                        diagnostics++;
                    },
                };
                programs.set(key, program);
            }
            const previous = properties.get(material)?.programs ?? new Map();
            previous.set(key, program);
            properties.set(material, {
                currentProgram:
                    changedActualProgram && !temporary
                        ? {
                              ...program,
                              program: new NativeProgram(),
                              cacheKey: 'changed-current',
                          }
                        : program,
                programs: previous,
            });
            material.addEventListener('dispose', () =>
                properties.delete(material),
            );
        });
        calls.push({ object, temporary });
    };
    const renderer: StaticPacketShaderRenderer = {
        properties: { get: (object) => properties.get(object) },
        shadowMap: { enabled: true, type: PCFShadowMap },
        toneMapping: NoToneMapping,
        outputColorSpace: SRGBColorSpace,
        clippingPlanes: [],
        localClippingEnabled: false,
        getRenderTarget: () => null,
        getContext: () => ({
            isContextLost: () => lost,
            LINK_STATUS: 35714,
            getProgramParameter: () => linked,
        }),
        compile: (object) => {
            initialize(object, false);
            return new Set();
        },
        compileAsync: async (object) => {
            initialize(object, true);
            return object;
        },
    };
    return {
        renderer,
        calls,
        properties,
        setLost: (value: boolean) => {
            lost = value;
        },
        setLinked: (value: boolean) => {
            linked = value;
        },
        setChangedActual: () => {
            changedActualProgram = true;
        },
        diagnostics: () => diagnostics,
    };
}

test('exact warm clones borrow buffers/maps/hooks and transfer the current native program before disposal', async () => {
    const fixture = rendererFixture();
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial({
        map: new Texture(),
        roughness: 0.31,
        metalness: 0.42,
    });
    material.onBeforeCompile = () => {};
    material.customProgramCacheKey = () => 'same-live-weather-owner';
    const object = new InstancedMesh(geometry, material, 2);
    object.receiveShadow = true;
    let sourceDisposed = 0;
    let textureDisposed = 0;
    geometry.addEventListener('dispose', () => sourceDisposed++);
    material.addEventListener('dispose', () => sourceDisposed++);
    material.map?.addEventListener('dispose', () => textureDisposed++);
    const job = compileStaticPacketShaders(
        fixture.renderer,
        [object],
        new OrthographicCamera(),
        new Scene(),
    );
    assert.equal(await job.completion, true);
    const probe = fixture.calls[0].object.children[0];
    assert.ok(probe instanceof InstancedMesh);
    assert.equal(probe.geometry, geometry);
    assert.equal(probe.count, 0);
    assert.notEqual(probe.material, material);
    assert.equal(probe.material.onBeforeCompile, material.onBeforeCompile);
    assert.equal(
        probe.material.customProgramCacheKey,
        material.customProgramCacheKey,
    );
    assert.ok(probe.material instanceof MeshStandardMaterial);
    assert.equal(probe.material.map, material.map);
    assert.equal(probe.material.roughness, 0.31);
    assert.equal(probe.receiveShadow, true);
    assert.equal(job.activate(new OrthographicCamera(), new Scene()), true);
    job.release();
    job.release();
    assert.equal(fixture.properties.has(probe.material), false);
    assert.equal(fixture.properties.has(material), true);
    assert.equal(sourceDisposed, 0);
    assert.equal(textureDisposed, 0);
    assert.equal(fixture.diagnostics(), 1);
});

test('resident old warm key cannot validate a different current actual program', async () => {
    const fixture = rendererFixture();
    const object = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const camera = new OrthographicCamera();
    const scene = new Scene();
    const job = compileStaticPacketShaders(
        fixture.renderer,
        [object],
        camera,
        scene,
    );
    assert.equal(await job.completion, true);
    fixture.setChangedActual();
    assert.equal(job.activate(camera, scene), false);
    job.release();
});

test('parallel completion does not accept a LINK_STATUS failure or lost context', async () => {
    const fixture = rendererFixture();
    const object = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    fixture.setLinked(false);
    const job = compileStaticPacketShaders(
        fixture.renderer,
        [object],
        new OrthographicCamera(),
        new Scene(),
    );
    assert.equal(await job.completion, false);
    assert.equal(job.activate(new OrthographicCamera(), new Scene()), false);
    job.release();
    fixture.setLost(true);
    const lost = compileStaticPacketShaders(
        fixture.renderer,
        [object],
        new OrthographicCamera(),
        new Scene(),
    );
    assert.equal(await lost.completion, false);
    lost.release();
});

test('unsupported skin/morph/transparent objects do not warm an inexact variant', () => {
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial();
    assert.equal(
        supportsStaticPacketShaderWarmup(new SkinnedMesh(geometry, material)),
        false,
    );
    const batched = new BatchedMesh(1, 12, 12, material);
    assert.equal(supportsStaticPacketShaderWarmup(batched), false);
    batched.dispose();
    geometry.morphAttributes.position = [
        new Float32BufferAttribute([0, 0, 0], 3),
    ];
    assert.equal(
        supportsStaticPacketShaderWarmup(new Mesh(geometry, material)),
        false,
    );
    geometry.morphAttributes.position = [];
    material.transparent = true;
    assert.equal(
        supportsStaticPacketShaderWarmup(new Mesh(geometry, material)),
        false,
    );
});

test('cancelled parallel completion cannot retain clones or run first-use diagnostics after root cleanup', async () => {
    const fixture = rendererFixture();
    const material = new MeshStandardMaterial();
    const object = new Mesh(new BoxGeometry(), material);
    const job = compileStaticPacketShaders(
        fixture.renderer,
        [object],
        new OrthographicCamera(),
        new Scene(),
    );
    job.release();
    assert.equal(await job.completion, false);
    assert.equal(job.activate(new OrthographicCamera(), new Scene()), false);
    assert.equal(fixture.properties.size, 0);
    assert.equal(fixture.diagnostics(), 0);
});

test('foreign scene/camera and cache FBO renders cannot warm or invalidate root presentation', () => {
    const scene = new Scene(),
        camera = new OrthographicCamera();
    let target: WebGLRenderTarget | null = null;
    const calls: { scene: Scene; camera: OrthographicCamera }[] = [];
    const prepare = staticPacketPresentationPreparation(
        { getRenderTarget: () => target },
        scene,
        camera,
        (actualScene, actualCamera) => {
            assert.equal(actualCamera, camera);
            calls.push({ scene: actualScene, camera });
        },
    );
    prepare(new Scene(), camera);
    prepare(scene, new OrthographicCamera());
    target = new WebGLRenderTarget(1, 1);
    prepare(scene, camera);
    assert.equal(calls.length, 0);
    target.dispose();
    target = null;
    prepare(scene, camera);
    assert.deepEqual(calls, [{ scene, camera }]);
});

test('spotlight map shader bits invalidate readiness and unsupported probe grids keep authored fallback', () => {
    const fixture = schedulerFixture();
    const scene = new Scene(),
        camera = new OrthographicCamera();
    const spot = new SpotLight();
    scene.add(spot);
    const before = staticPacketShaderSceneKey(fixture.renderer, scene, camera);
    spot.map = new Texture();
    assert.notEqual(
        staticPacketShaderSceneKey(fixture.renderer, scene, camera),
        before,
    );
    const grid = new Group();
    Reflect.set(grid, 'isLightProbeGrid', true);
    scene.add(grid);
    fixture.scheduler.register(
        new Mesh(new BoxGeometry(), new MeshStandardMaterial()),
        () => {},
    );
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs.length, 0);
    assert.equal(fixture.scheduler.getSnapshot().ready, 0);
    scene.remove(grid);
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs.length, 1);
    fixture.scheduler.dispose();
    spot.map.dispose();
});

function schedulerFixture() {
    const fixture = rendererFixture();
    const jobs: {
        resolve: (ready: boolean) => void;
        releases: number;
        activations: number;
    }[] = [];
    let renderRequests = 0;
    const scheduler = new StaticRenderPacketShaderWarmup(
        (): StaticPacketShaderCompile => {
            const pending = deferred();
            const record = {
                resolve: pending.resolve,
                releases: 0,
                activations: 0,
            };
            jobs.push(record);
            return {
                completion: pending.completion,
                release: () => {
                    record.releases++;
                },
                activate: () => {
                    record.activations++;
                    return true;
                },
            };
        },
        fixture.renderer,
        () => {
            renderRequests++;
        },
    );
    return { ...fixture, jobs, scheduler, requests: () => renderRequests };
}

test('source/hook/layout/layer changes retire in-flight results, and ready lights/environment changes requeue', async () => {
    const fixture = schedulerFixture();
    const object = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const scene = new Scene();
    const camera = new OrthographicCamera();
    const ready: boolean[] = [];
    const release = fixture.scheduler.register(object, (value) =>
        ready.push(value),
    );
    fixture.scheduler.prepare(scene, camera);
    object.material.onBeforeCompile = () => {};
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs[0].releases, 1);
    fixture.jobs[0].resolve(true);
    await Promise.resolve();
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs[0].activations, 0);
    fixture.jobs[1].resolve(true);
    await Promise.resolve();
    fixture.scheduler.prepare(scene, camera);
    assert.equal(ready.at(-1), true);
    scene.add(new DirectionalLight());
    fixture.scheduler.prepare(scene, camera);
    assert.equal(ready.at(-1), false);
    scene.environment = new Texture();
    object.layers.set(2);
    object.geometry.setAttribute(
        'color',
        new Float32BufferAttribute([1, 1, 1], 3),
    );
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs[2].releases, 1);
    fixture.jobs[2].resolve(true);
    await Promise.resolve();
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs[2].activations, 0);
    release();
    fixture.scheduler.dispose();
    assert.equal(fixture.scheduler.getSnapshot().objects, 0);
});

test('never-settling timeout/context cancellation releases clones and rejects late results', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const fixture = schedulerFixture();
    const object = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const scene = new Scene();
    const camera = new OrthographicCamera();
    fixture.scheduler.register(object, () => {});
    fixture.scheduler.prepare(scene, camera);
    context.mock.timers.tick(staticPacketShaderWarmupLimits.timeoutMs);
    assert.equal(fixture.jobs[0].releases, 1);
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs[0].activations, 0);
    fixture.jobs[0].resolve(true);
    await Promise.resolve();
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs[0].activations, 0);
    fixture.scheduler.invalidate();
    fixture.scheduler.prepare(scene, camera);
    fixture.setLost(true);
    fixture.scheduler.invalidate();
    assert.equal(fixture.jobs[1].releases, 1);
    fixture.jobs[1].resolve(true);
    await Promise.resolve();
    fixture.scheduler.prepare(scene, camera);
    assert.equal(fixture.jobs[1].activations, 0);
    fixture.scheduler.dispose();
});

test('active/batch bounds and duplicate out-of-order leases leave no idle jobs after release', () => {
    const fixture = schedulerFixture();
    const releases: (() => void)[] = [];
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial();
    const first = new Mesh(geometry, material);
    const listener = () => {};
    const duplicate = fixture.scheduler.register(first, listener);
    for (
        let index = 0;
        index < staticPacketShaderWarmupLimits.activeObjects + 5;
        index++
    )
        releases.push(
            fixture.scheduler.register(
                index === 0 ? first : new Mesh(geometry, material),
                index === 0 ? listener : () => {},
            ),
        );
    assert.equal(fixture.scheduler.getSnapshot().objects, 256);
    fixture.scheduler.prepare(new Scene(), new OrthographicCamera());
    assert.equal(fixture.scheduler.getSnapshot().compiling, 64);
    duplicate();
    assert.equal(fixture.jobs[0].releases, 0);
    for (const release of releases.reverse()) release();
    assert.equal(fixture.scheduler.getSnapshot().objects, 0);
    assert.equal(fixture.jobs[0].releases, 1);
    fixture.scheduler.dispose();
});
