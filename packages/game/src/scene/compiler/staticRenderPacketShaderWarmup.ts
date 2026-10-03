import {
    BatchedMesh,
    type BufferGeometry,
    type Camera,
    Group,
    InstancedMesh,
    Light,
    type Material,
    Mesh,
    type Object3D,
    type Scene,
    SkinnedMesh,
    SpotLight,
    type WebGLRenderer,
} from 'three';
import { meshGeometryLayoutSignature } from './meshBuffers';

export const staticPacketShaderWarmupLimits = {
    activeObjects: 256,
    batchObjects: 64,
    timeoutMs: 4_000,
};

export type StaticPacketShaderObject = Mesh<BufferGeometry, Material>;
export type StaticPacketShaderRenderer = Pick<
    WebGLRenderer,
    | 'compile'
    | 'compileAsync'
    | 'clippingPlanes'
    | 'getRenderTarget'
    | 'localClippingEnabled'
    | 'outputColorSpace'
    | 'toneMapping'
> & {
    properties: Pick<WebGLRenderer['properties'], 'get'>;
    shadowMap: Pick<WebGLRenderer['shadowMap'], 'enabled' | 'type'>;
    getContext: () => Pick<
        WebGL2RenderingContext,
        'isContextLost' | 'getProgramParameter' | 'LINK_STATUS'
    >;
};
type ShaderProgram = {
    cacheKey: string;
    program: WebGLProgram;
    isReady: () => boolean;
    getUniforms: () => unknown;
};

function shaderProgram(value: unknown): ShaderProgram | undefined {
    if (
        value !== null &&
        typeof value === 'object' &&
        'cacheKey' in value &&
        typeof value.cacheKey === 'string' &&
        'program' in value &&
        typeof WebGLProgram !== 'undefined' &&
        value.program instanceof WebGLProgram &&
        'isReady' in value &&
        typeof value.isReady === 'function' &&
        'getUniforms' in value &&
        typeof value.getUniforms === 'function'
    ) {
        const isReady = value.isReady;
        const getUniforms = value.getUniforms;
        // Preserve receivers without assuming the shape of nullable renderer properties.
        return {
            cacheKey: value.cacheKey,
            program: value.program,
            isReady: () => isReady.call(value) === true,
            getUniforms: () => getUniforms.call(value),
        };
    }
    return undefined;
}

function currentProgram(
    renderer: StaticPacketShaderRenderer,
    material: Material,
) {
    const properties: unknown = renderer.properties.get(material);
    return properties !== null &&
        typeof properties === 'object' &&
        'currentProgram' in properties
        ? shaderProgram(properties.currentProgram)
        : undefined;
}

export function supportsStaticPacketShaderWarmup(
    object: StaticPacketShaderObject,
) {
    return (
        !(object instanceof SkinnedMesh) &&
        !(object instanceof BatchedMesh) &&
        !object.material.transparent &&
        Object.values(object.geometry.morphAttributes).every(
            (attributes) => attributes.length === 0,
        ) &&
        (!object.morphTargetInfluences ||
            object.morphTargetInfluences.length === 0) &&
        (!(object instanceof InstancedMesh) || object.morphTexture === null)
    );
}

/** A compile-only object borrows geometry; it never renders or uploads instance buffers. */
function shaderObject(source: StaticPacketShaderObject, material: Material) {
    const object =
        source instanceof InstancedMesh
            ? new InstancedMesh(source.geometry, material, 0)
            : new Mesh(source.geometry, material);
    if (source instanceof InstancedMesh && object instanceof InstancedMesh)
        object.instanceColor = source.instanceColor;
    object.castShadow = source.castShadow;
    object.receiveShadow = source.receiveShadow;
    object.layers.mask = source.layers.mask;
    return object;
}

export type StaticPacketShaderCompile = {
    completion: Promise<boolean>;
    activate: (camera: Camera, scene: Scene) => boolean;
    release: () => void;
};

/** Cache capture and outline/foreign roots retain range guards, but do not own readiness. */
export function staticPacketPresentationPreparation(
    renderer: Pick<StaticPacketShaderRenderer, 'getRenderTarget'>,
    scene: Scene,
    camera: Camera,
    prepare: (scene: Scene, camera: Camera) => void,
) {
    return (renderedScene: Object3D, renderedCamera: Camera) => {
        if (
            renderedScene === scene &&
            renderedCamera === camera &&
            renderer.getRenderTarget() === null
        )
            prepare(scene, camera);
    };
}

/**
 * Temporary material clones stop Three's readiness polling on cancellation.
 * Their exact live hooks/maps and object feature flags reuse the real shader;
 * successful activation acquires that same native program before disposal.
 */
export function compileStaticPacketShaders(
    renderer: StaticPacketShaderRenderer,
    objects: readonly StaticPacketShaderObject[],
    camera: Camera,
    scene: Scene,
): StaticPacketShaderCompile {
    const root = new Group();
    const materials: Material[] = [];
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        root.clear();
        for (const material of materials) material.dispose();
    };
    const programs: ShaderProgram[] = [];
    let pending: Promise<unknown>;
    try {
        if (
            renderer.getContext().isContextLost() ||
            objects.some((object) => !supportsStaticPacketShaderWarmup(object))
        )
            pending = Promise.reject(
                new Error('Unsupported or lost-context shader warmup.'),
            );
        else {
            for (const object of objects) {
                const material = object.material.clone();
                materials.push(material);
                material.onBeforeCompile = object.material.onBeforeCompile;
                material.customProgramCacheKey =
                    object.material.customProgramCacheKey;
                root.add(shaderObject(object, material));
            }
            pending = renderer.compileAsync(root, camera, scene);
        }
    } catch (error) {
        pending = Promise.reject(error);
    }
    const completion = pending
        .then(() => {
            if (released || renderer.getContext().isContextLost()) return false;
            for (const material of materials) {
                const program = currentProgram(renderer, material);
                if (!program?.isReady()) return false;
                // Keep Three's diagnostics enabled, after parallel completion.
                program.getUniforms();
                if (
                    renderer
                        .getContext()
                        .getProgramParameter(
                            program.program,
                            renderer.getContext().LINK_STATUS,
                        ) !== true
                )
                    return false;
                programs.push(program);
            }
            return true;
        })
        .catch(() => false);
    return {
        completion,
        release,
        activate: (currentCamera, currentScene) => {
            if (
                released ||
                programs.length !== objects.length ||
                renderer.getContext().isContextLost()
            )
                return false;
            try {
                return objects.every((object, index) => {
                    const warm = programs[index];
                    // Check the selected current variant before another object
                    // sharing this material can select a different program.
                    renderer.compile(
                        shaderObject(object, object.material),
                        currentCamera,
                        currentScene,
                    );
                    const actual = currentProgram(renderer, object.material);
                    return (
                        actual?.program === warm.program &&
                        actual.cacheKey === warm.cacheKey &&
                        actual.isReady() &&
                        renderer
                            .getContext()
                            .getProgramParameter(
                                actual.program,
                                renderer.getContext().LINK_STATUS,
                            ) === true
                    );
                });
            } catch {
                return false;
            }
        },
    };
}

function objectInputs(object: StaticPacketShaderObject) {
    return {
        geometry: object.geometry,
        material: object.material,
        version: object.material.version,
        hook: object.material.onBeforeCompile,
        cacheKeyHook: object.material.customProgramCacheKey,
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow,
        layers: object.layers.mask,
        instanceColor:
            object instanceof InstancedMesh ? object.instanceColor : null,
        morphTexture:
            object instanceof InstancedMesh ? object.morphTexture : null,
        morphInfluences: object.morphTargetInfluences?.length ?? 0,
        transparent: object.material.transparent,
    };
}

function sameInputs(
    left: ReturnType<typeof objectInputs>,
    object: StaticPacketShaderObject,
) {
    return (
        left.geometry === object.geometry &&
        left.material === object.material &&
        left.version === object.material.version &&
        left.hook === object.material.onBeforeCompile &&
        left.cacheKeyHook === object.material.customProgramCacheKey &&
        left.castShadow === object.castShadow &&
        left.receiveShadow === object.receiveShadow &&
        left.layers === object.layers.mask &&
        left.instanceColor ===
            (object instanceof InstancedMesh ? object.instanceColor : null) &&
        left.morphTexture ===
            (object instanceof InstancedMesh ? object.morphTexture : null) &&
        left.morphInfluences === (object.morphTargetInfluences?.length ?? 0) &&
        left.transparent === object.material.transparent
    );
}

export function staticPacketShaderSceneKey(
    renderer: StaticPacketShaderRenderer,
    scene: Scene,
    camera: Camera,
) {
    const lights: string[] = [];
    let unsupportedProbeGrid = false;
    scene.traverseVisible((object) => {
        if (
            'isLightProbeGrid' in object &&
            object.isLightProbeGrid === true &&
            object.layers.test(camera.layers)
        )
            unsupportedProbeGrid = true;
        if (object instanceof Light && object.layers.test(camera.layers))
            lights.push(
                `${object.uuid}:${object.type}:${object.castShadow ? 1 : 0}:${object instanceof SpotLight && object.map ? 1 : 0}`,
            );
    });
    // Three's compile traversal does not collect probe grids as its live
    // render traversal does. Keep authored presentation for that setup.
    if (unsupportedProbeGrid) return undefined;
    return [
        scene.uuid,
        camera.uuid,
        camera.type,
        camera.layers.mask,
        renderer.shadowMap.enabled,
        renderer.shadowMap.type,
        renderer.toneMapping,
        renderer.outputColorSpace,
        renderer.getRenderTarget()?.texture.uuid,
        renderer.localClippingEnabled,
        renderer.clippingPlanes.length,
        scene.environment?.uuid,
        scene.environment?.version,
        scene.environment?.mapping,
        scene.fog?.constructor.name,
        lights.sort().join(','),
    ].join('|');
}

type Entry = {
    object: StaticPacketShaderObject;
    listeners: Map<symbol, (ready: boolean) => void>;
    inputs: ReturnType<typeof objectInputs>;
    key: string;
    sceneKey: string | undefined;
    state: 'queued' | 'compiling' | 'ready' | 'failed';
};
type Batch = {
    entries: Entry[];
    keys: string[];
    sceneKey: string;
    compile: StaticPacketShaderCompile;
    compileReleased: boolean;
    settled: boolean | undefined;
    timeout: ReturnType<typeof setTimeout>;
};

/** One active batch, no idle shader/material resources, no polling heartbeat. */
export class StaticRenderPacketShaderWarmup {
    private readonly entries = new Map<StaticPacketShaderObject, Entry>();
    private batch: Batch | undefined;
    private disposed = false;

    constructor(
        private readonly compiler: typeof compileStaticPacketShaders,
        private readonly renderer: StaticPacketShaderRenderer,
        private readonly requestRender: () => void,
    ) {}

    register(
        object: StaticPacketShaderObject,
        listener: (ready: boolean) => void,
    ) {
        if (
            this.disposed ||
            !supportsStaticPacketShaderWarmup(object) ||
            (!this.entries.has(object) &&
                this.entries.size >=
                    staticPacketShaderWarmupLimits.activeObjects)
        ) {
            listener(false);
            return () => {};
        }
        let entry = this.entries.get(object);
        if (!entry) {
            entry = {
                object,
                listeners: new Map(),
                inputs: objectInputs(object),
                key: this.objectKey(object),
                sceneKey: undefined,
                state: 'queued',
            };
            this.entries.set(object, entry);
        }
        const lease = entry;
        const listenerId = Symbol();
        lease.listeners.set(listenerId, listener);
        listener(lease.state === 'ready');
        this.requestRender();
        let released = false;
        return () => {
            if (released) return;
            released = true;
            lease.listeners.delete(listenerId);
            if (lease.listeners.size > 0) return;
            this.entries.delete(object);
            if (this.batch?.entries.includes(lease)) this.cancelBatch();
        };
    }

    private publish(entry: Entry, state: Entry['state']) {
        if (entry.state === state) return;
        entry.state = state;
        for (const listener of entry.listeners.values())
            listener(state === 'ready');
    }

    private releaseCompile(batch: Batch) {
        if (batch.compileReleased) return;
        batch.compileReleased = true;
        batch.compile.release();
    }

    private cancelBatch() {
        const batch = this.batch;
        if (!batch) return;
        this.batch = undefined;
        clearTimeout(batch.timeout);
        this.releaseCompile(batch);
        for (const entry of batch.entries)
            if (this.entries.get(entry.object) === entry)
                this.publish(entry, 'queued');
    }

    invalidate() {
        this.cancelBatch();
        for (const entry of this.entries.values())
            this.publish(entry, 'queued');
        this.requestRender();
    }

    /** Called immediately before real rendering, after light/weather decorators. */
    prepare(scene: Scene, camera: Camera) {
        if (this.disposed || this.renderer.getContext().isContextLost()) return;
        if (this.entries.size === 0) return;
        const sceneKey = staticPacketShaderSceneKey(
            this.renderer,
            scene,
            camera,
        );
        if (sceneKey === undefined) {
            this.cancelBatch();
            for (const entry of this.entries.values()) {
                entry.sceneKey = 'unsupported-light-probe-grid';
                this.publish(entry, 'failed');
            }
            return;
        }
        for (const entry of this.entries.values()) {
            const key = this.objectKey(entry.object);
            if (
                !sameInputs(entry.inputs, entry.object) ||
                entry.key !== key ||
                (entry.sceneKey !== undefined && entry.sceneKey !== sceneKey)
            ) {
                if (this.batch?.entries.includes(entry)) this.cancelBatch();
                entry.inputs = objectInputs(entry.object);
                entry.key = key;
                entry.sceneKey = sceneKey;
                this.publish(entry, 'queued');
            }
        }
        const batch = this.batch;
        if (batch && batch.settled !== undefined) {
            const keys = batch.entries.map((entry) =>
                this.objectKey(entry.object),
            );
            if (
                batch.sceneKey !== sceneKey ||
                keys.some((key, index) => key !== batch.keys[index])
            ) {
                this.cancelBatch();
            } else {
                this.batch = undefined;
                clearTimeout(batch.timeout);
                const ready =
                    batch.settled && batch.compile.activate(camera, scene);
                this.releaseCompile(batch);
                for (const entry of batch.entries)
                    this.publish(entry, ready ? 'ready' : 'failed');
            }
        }
        if (this.batch) return;
        const queued = [...this.entries.values()]
            .filter((entry) => entry.state === 'queued')
            .slice(0, staticPacketShaderWarmupLimits.batchObjects);
        if (queued.length === 0) return;
        try {
            const compile = this.compiler(
                this.renderer,
                queued.map((entry) => entry.object),
                camera,
                scene,
            );
            const next: Batch = {
                entries: queued,
                keys: queued.map((entry) => this.objectKey(entry.object)),
                sceneKey,
                compile,
                compileReleased: false,
                settled: undefined,
                timeout: setTimeout(() => {
                    if (this.batch !== next) return;
                    next.settled = false;
                    this.releaseCompile(next);
                    this.requestRender();
                }, staticPacketShaderWarmupLimits.timeoutMs),
            };
            this.batch = next;
            for (const entry of queued) {
                entry.sceneKey = sceneKey;
                this.publish(entry, 'compiling');
            }
            const settle = (ready: boolean) => {
                if (this.batch !== next || next.settled !== undefined) return;
                next.settled = ready;
                this.requestRender();
            };
            void compile.completion.then(settle, () => settle(false));
        } catch {
            for (const entry of queued) this.publish(entry, 'failed');
        }
    }

    private objectKey(object: StaticPacketShaderObject) {
        return [
            object.material.uuid,
            object.material.version,
            object.material.customProgramCacheKey(),
            meshGeometryLayoutSignature(object.geometry),
            object instanceof InstancedMesh,
            object instanceof InstancedMesh && Boolean(object.instanceColor),
            object.castShadow,
            object.receiveShadow,
            object.layers.mask,
        ].join('|');
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.cancelBatch();
        this.entries.clear();
    }

    getSnapshot() {
        return {
            objects: this.entries.size,
            compiling: this.batch?.entries.length ?? 0,
            queued: [...this.entries.values()].filter(
                (entry) => entry.state === 'queued',
            ).length,
            ready: [...this.entries.values()].filter(
                (entry) => entry.state === 'ready',
            ).length,
        };
    }
}
