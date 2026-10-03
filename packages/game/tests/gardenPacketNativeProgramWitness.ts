import { InstancedMesh, type Object3D, type WebGLRenderer } from 'three';

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export type GardenPacketProgramDraw = {
    kind: 'authored' | 'pending' | 'singleton' | 'compiled';
    pass: 'main' | 'shadow';
    name: string;
    programId: number;
    cacheKey: string;
    instancing: boolean;
    shaderInstancing: boolean;
    instanceCount: number | null;
    geometryId: string;
    calls: number;
};

/** CT-only witness: native resource identity and exact renderer keys after positive submissions. */
export class GardenPacketNativeProgramWitness {
    private epoch = '';
    private readonly ids = new WeakMap<object, number>();
    private nextId = 0;
    private readonly programs = new Set<object>();
    private readonly buffers = new Set<object>();
    private readonly draws = new Map<string, GardenPacketProgramDraw>();
    private programPeak = 0;
    private createdPrograms = 0;
    private deletedPrograms = 0;
    private createdBuffers = 0;
    private deletedBuffers = 0;

    setEpoch(epoch: string) {
        if (this.epoch === epoch) return;
        this.epoch = epoch;
        this.draws.clear();
    }

    private id(resource: object) {
        let id = this.ids.get(resource);
        if (id === undefined) {
            id = ++this.nextId;
            this.ids.set(resource, id);
        }
        return id;
    }

    install(renderer: WebGLRenderer, mainCamera: object) {
        const context = renderer.getContext();
        const createProgram = context.createProgram;
        const deleteProgram = context.deleteProgram;
        const createBuffer = context.createBuffer;
        const deleteBuffer = context.deleteBuffer;
        const render = renderer.renderBufferDirect;
        const programCreated: typeof createProgram = () => {
            const program = createProgram.call(context);
            if (program) {
                this.programs.add(program);
                this.createdPrograms++;
                this.programPeak = Math.max(
                    this.programPeak,
                    this.programs.size,
                );
            }
            return program;
        };
        const programDeleted: typeof deleteProgram = (program) => {
            if (program && this.programs.delete(program))
                this.deletedPrograms++;
            deleteProgram.call(context, program);
        };
        const bufferCreated: typeof createBuffer = () => {
            const buffer = createBuffer.call(context);
            if (buffer) {
                this.buffers.add(buffer);
                this.createdBuffers++;
            }
            return buffer;
        };
        const bufferDeleted: typeof deleteBuffer = (buffer) => {
            if (buffer && this.buffers.delete(buffer)) this.deletedBuffers++;
            deleteBuffer.call(context, buffer);
        };
        const observed: typeof render = (...args) => {
            const [camera, , geometry, material, object] = args;
            const calls = renderer.info.render.calls;
            render.apply(renderer, args);
            if (renderer.info.render.calls <= calls) return;
            const kind = this.kind(object);
            if (!kind) return;
            const properties: unknown = renderer.properties.get(material);
            if (!record(properties) || !record(properties.currentProgram))
                throw new Error(
                    'Positive stock draw must retain its actual native program.',
                );
            const program = properties.currentProgram;
            if (
                !record(program.program) ||
                typeof program.cacheKey !== 'string' ||
                typeof properties.instancing !== 'boolean'
            )
                throw new Error(
                    'Native program identity, key and instancing metadata are required.',
                );
            const vertexShader = program.vertexShader;
            if (!(vertexShader instanceof WebGLShader))
                throw new Error('Native vertex shader witness is required.');
            const source = context.getShaderSource(vertexShader);
            if (!source)
                throw new Error('Native vertex shader source is required.');
            const programId = this.id(program.program);
            const pass = camera === mainCamera ? 'main' : 'shadow';
            const key = `${kind}:${pass}:${object.uuid}:${programId}`;
            const old = this.draws.get(key);
            if (old) old.calls += renderer.info.render.calls - calls;
            else
                this.draws.set(key, {
                    kind,
                    pass,
                    name: object.name,
                    programId,
                    cacheKey: program.cacheKey,
                    instancing: properties.instancing,
                    shaderInstancing: /^#define USE_INSTANCING\s*$/m.test(
                        source,
                    ),
                    instanceCount:
                        object instanceof InstancedMesh ? object.count : null,
                    geometryId: geometry.uuid,
                    calls: renderer.info.render.calls - calls,
                });
        };
        context.createProgram = programCreated;
        context.deleteProgram = programDeleted;
        context.createBuffer = bufferCreated;
        context.deleteBuffer = bufferDeleted;
        renderer.renderBufferDirect = observed;
        return () => {
            if (context.createProgram === programCreated)
                context.createProgram = createProgram;
            if (context.deleteProgram === programDeleted)
                context.deleteProgram = deleteProgram;
            if (context.createBuffer === bufferCreated)
                context.createBuffer = createBuffer;
            if (context.deleteBuffer === bufferDeleted)
                context.deleteBuffer = deleteBuffer;
            if (renderer.renderBufferDirect === observed)
                renderer.renderBufferDirect = render;
        };
    }

    private kind(object: Object3D) {
        if (object.name.startsWith('StaticRenderPacket:')) {
            if (object.name.includes(':fallback:')) return 'pending';
            if (object.name.endsWith(':singleton')) return 'singleton';
            return 'compiled';
        }
        if (
            object.name.startsWith('BlockInstances:admission:') &&
            !object.name.startsWith('BlockInstances:admission:unknown:')
        )
            return 'authored';
        return undefined;
    }

    read() {
        return {
            epoch: this.epoch,
            draws: [...this.draws.values()],
            livePrograms: this.programs.size,
            liveBuffers: this.buffers.size,
            programPeak: this.programPeak,
            createdPrograms: this.createdPrograms,
            deletedPrograms: this.deletedPrograms,
            createdBuffers: this.createdBuffers,
            deletedBuffers: this.deletedBuffers,
        };
    }
}

export function readGardenPacketNativeProgramWitness(value: unknown) {
    if (!record(value) || !Array.isArray(value.draws))
        throw new Error('Native program witness is required.');
    const draws = value.draws.map((draw: unknown) => {
        if (
            !record(draw) ||
            !['authored', 'pending', 'singleton', 'compiled'].includes(
                String(draw.kind),
            ) ||
            !['main', 'shadow'].includes(String(draw.pass)) ||
            typeof draw.name !== 'string' ||
            typeof draw.programId !== 'number' ||
            typeof draw.cacheKey !== 'string' ||
            typeof draw.instancing !== 'boolean' ||
            typeof draw.shaderInstancing !== 'boolean' ||
            typeof draw.geometryId !== 'string' ||
            typeof draw.calls !== 'number' ||
            draw.calls <= 0
        )
            throw new Error('Native program draw metadata is incomplete.');
        return {
            kind: draw.kind,
            pass: draw.pass,
            name: draw.name,
            programId: draw.programId,
            cacheKey: draw.cacheKey,
            instancing: draw.instancing,
            shaderInstancing: draw.shaderInstancing,
            geometryId: draw.geometryId,
            calls: draw.calls,
            instanceCount: draw.instanceCount,
        };
    });
    const count = (name: string) => {
        const result = value[name];
        if (
            typeof result !== 'number' ||
            !Number.isSafeInteger(result) ||
            result < 0
        )
            throw new Error(
                `Native program witness ${name} must be a resource count.`,
            );
        return result;
    };
    return {
        draws,
        livePrograms: count('livePrograms'),
        liveBuffers: count('liveBuffers'),
        programPeak: count('programPeak'),
        createdPrograms: count('createdPrograms'),
        deletedPrograms: count('deletedPrograms'),
        createdBuffers: count('createdBuffers'),
        deletedBuffers: count('deletedBuffers'),
    };
}
