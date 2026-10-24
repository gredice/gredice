import { AnimationAction, AnimationMixer, type Object3D } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

type Transform = { position: number[]; quaternion: number[]; scale: number[] };
export type FaunaPoseSource = {
    file: string;
    name: string;
    referenceCommit: string;
    referenceHash: string;
    actualHash: string;
    helperHashes: Record<string, string>;
};
export type FaunaPoseOracleFrame = {
    pass: boolean;
    checks: number;
    checkedPoses: { actor: string; node: string }[];
    maxError: number;
    poseHash: string;
    sources: FaunaPoseSource[];
    clips: { actor: string; name: string; hash: string }[];
    calls: {
        actor: string;
        sourceId: string;
        inputs: Record<string, unknown>;
        clock: {
            policy: 'render' | 'presentation';
            anchor: number;
            time: number;
            delta: number;
        };
    }[];
    mixers: { actor: string; delta: number; time: number }[];
    commands: {
        actor: string;
        clip: string;
        method: string;
        args: unknown[];
        at: number;
    }[];
    semanticWrites: { actor: string; node: string; transform: Transform }[];
    semanticInputs: {
        actor: string;
        sourceId: string;
        key: string;
        value: unknown;
    }[];
    presences: unknown[];
    simulationSteps: { now: number; delta: number }[];
    actorRoots: {
        actor: string;
        matchesObservedParent: boolean;
        local: Transform;
        matrixWorld: number[];
    }[];
};
type Model = {
    root: Object3D;
    expected: Object3D;
    nodes: Map<Object3D, Object3D>;
    known: Map<Object3D, Transform>;
    id: string;
    visual?: { node: Object3D; transform: Transform };
    actorRoot?: Object3D;
    observedActorRoot?: Object3D;
};
const transform = (node: Object3D): Transform => ({
    position: node.position.toArray(),
    quaternion: node.quaternion.toArray(),
    scale: node.scale.toArray(),
});
const isObject3D = (value: unknown): value is Object3D =>
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'isObject3D') === true;
const sameTransform = (left: Transform, right: Transform) =>
    JSON.stringify(left) === JSON.stringify(right);
const isPoseNode = (node: Object3D, root: Object3D) =>
    node === root || node.type === 'Bone' || node.name.includes('Pivot');

export function createFaunaPoseOracle(
    mode: 'baseline' | 'candidate' = 'candidate',
) {
    const models = new Map<Object3D, Model>();
    const nodeModels = new WeakMap<Object3D, Model>();
    const persistentInputs = new WeakMap<object, object>();
    const knownInputs = new WeakMap<object, Record<string, unknown>>();
    const mixers = new WeakMap<AnimationMixer, AnimationMixer>();
    const actions = new WeakMap<AnimationAction, AnimationAction>();
    let frame: Omit<FaunaPoseOracleFrame, 'poseHash'> = emptyFrame();
    let mirroring = 0;
    let now = 0;
    let delta = 0;
    let resumed = false;
    let recording = false;
    let pendingCommands: FaunaPoseOracleFrame['commands'] = [];
    const sources = new Set<string>();
    const commandModels = new WeakMap<object, Model>();
    const newClips = new Map<AnimationAction, string>();
    const simulationAnchors = new WeakMap<Object3D, number>();
    const checkedPoses = new Map<string, { actor: string; node: string }>();
    let inputActor = '',
        inputSource = '';
    function emptyFrame() {
        return {
            pass: true,
            checks: 0,
            checkedPoses: [],
            maxError: 0,
            sources: [],
            clips: [],
            calls: [],
            mixers: [],
            commands: [],
            semanticWrites: [],
            semanticInputs: [],
            presences: [],
            simulationSteps: [],
            actorRoots: [],
        } satisfies Omit<FaunaPoseOracleFrame, 'poseHash'>;
    }
    function ensureModel(root: Object3D): Model {
        const retained = models.get(root);
        if (retained) return retained;
        const expected = cloneSkeleton(root);
        const nodes = new Map<Object3D, Object3D>();
        const known = new Map<Object3D, Transform>();
        const model: Model = { root, expected, nodes, known, id: root.name };
        function pair(actual: Object3D, counterpart: Object3D) {
            nodes.set(actual, counterpart);
            known.set(actual, transform(actual));
            nodeModels.set(actual, model);
            actual.children.forEach((child, index) => {
                const other = counterpart.children[index];
                if (other) pair(child, other);
            });
        }
        pair(root, expected);
        models.set(root, model);
        return model;
    }
    function modelForNode(node: Object3D) {
        const retained = nodeModels.get(node);
        if (retained) return retained;
        let root = node;
        while (root.parent && !root.parent.name.startsWith('witness:')) {
            const instance: unknown = Reflect.get(root, '__r3f');
            if (
                typeof instance === 'object' &&
                instance !== null &&
                Reflect.get(instance, 'type') === 'primitive'
            )
                break;
            root = root.parent;
        }
        return ensureModel(root);
    }
    function synchronize(model: Model) {
        for (const [actual, expected] of model.nodes) {
            const now = transform(actual),
                old = model.known.get(actual);
            if (old && !sameTransform(now, old)) {
                expected.position.copy(actual.position);
                expected.rotation.copy(actual.rotation);
                expected.scale.copy(actual.scale);
                if (isPoseNode(actual, model.root))
                    frame.semanticWrites.push({
                        actor: model.id,
                        node: actual === model.root ? '@model' : actual.name,
                        transform: now,
                    });
            }
            model.known.set(actual, now);
        }
    }
    function remember(model: Model) {
        for (const actual of model.nodes.keys())
            model.known.set(actual, transform(actual));
    }
    function verify(model: Model) {
        if (
            model.visual &&
            !sameTransform(transform(model.visual.node), model.visual.transform)
        )
            throw new Error(`${model.id}: immutable visual wrapper changed`);
        if (model.visual) {
            checkedPoses.set(`${model.id}:@visual`, {
                actor: model.id,
                node: '@visual',
            });
            frame.checks += 3;
        }
        for (const [actual, expected] of model.nodes) {
            if (!isPoseNode(actual, model.root)) continue;
            const node = actual === model.root ? '@model' : actual.name;
            checkedPoses.set(`${model.id}:${node}`, { actor: model.id, node });
            const left = transform(actual),
                right = transform(expected);
            for (const key of ['position', 'quaternion', 'scale'] as const) {
                const dot =
                    key === 'quaternion'
                        ? left[key].reduce(
                              (sum, value, index) =>
                                  sum + value * right[key][index],
                              0,
                          )
                        : 1;
                const error = Math.max(
                    ...left[key].map((value, index) =>
                        Math.abs(
                            value -
                                (dot < 0
                                    ? -right[key][index]
                                    : right[key][index]),
                        ),
                    ),
                );
                frame.checks++;
                frame.maxError = Math.max(frame.maxError, error);
                if (!Number.isFinite(error) || error > 1e-10) {
                    frame.pass = false;
                    throw new Error(
                        `${model.id}:${actual.name}:${key} independent frozen pose drift ${error}`,
                    );
                }
            }
        }
    }
    function cloneInput(value: unknown, persistent = false): unknown {
        if (isObject3D(value)) return modelForNode(value).nodes.get(value);
        if (Array.isArray(value))
            return value.map((entry) => cloneInput(entry));
        if (typeof value !== 'object' || value === null) return value;
        if (typeof Reflect.get(value, 'clone') === 'function')
            return Reflect.apply(Reflect.get(value, 'clone'), value, []);
        let result = persistent ? persistentInputs.get(value) : undefined;
        const previous = persistent ? knownInputs.get(value) : undefined;
        if (!result) result = {};
        for (const [key, input] of Object.entries(value)) {
            if (
                persistent &&
                previous &&
                previous[key] !== input &&
                typeof input !== 'object'
            )
                frame.semanticInputs.push({
                    actor: inputActor,
                    sourceId: inputSource,
                    key,
                    value: input,
                });
            if (
                !persistent ||
                !previous ||
                previous[key] !== input ||
                typeof input === 'object'
            )
                Reflect.set(
                    result,
                    key,
                    cloneInput(input, key === 'rig' || key === 'blend'),
                );
        }
        if (persistent) persistentInputs.set(value, result);
        return result;
    }
    function rememberInputs(value: unknown, persistent = false) {
        if (isObject3D(value) || typeof value !== 'object' || value === null)
            return;
        if (persistent)
            knownInputs.set(value, Object.fromEntries(Object.entries(value)));
        for (const [key, input] of Object.entries(value))
            rememberInputs(input, key === 'rig' || key === 'blend');
    }
    function inputReceipt(value: unknown): unknown {
        if (isObject3D(value)) return { node: value.name };
        if (Array.isArray(value)) return value.map(inputReceipt);
        if (typeof value !== 'object' || value === null) return value;
        const result: Record<string, unknown> = {};
        for (const [key, input] of Object.entries(value)) {
            if (key === 'rig' || key === 'blend') continue;
            result[key] = inputReceipt(input);
        }
        return result;
    }
    function modelFromInputs(value: unknown): Model | undefined {
        if (isObject3D(value)) return modelForNode(value);
        if (typeof value !== 'object' || value === null) return undefined;
        for (const entry of Object.values(value)) {
            const model = modelFromInputs(entry);
            if (model) return model;
        }
    }
    function ensureMixer(mixer: AnimationMixer) {
        let expected = mixers.get(mixer);
        if (!expected) {
            expected = new AnimationMixer(mixerModel(mixer).expected);
            mixers.set(mixer, expected);
        }
        return expected;
    }
    function mixerModel(mixer: AnimationMixer) {
        const root = mixer.getRoot();
        if (!isObject3D(root))
            throw new Error('Fauna oracle requires an individual actor rig');
        return ensureModel(root);
    }
    function command(action: AnimationAction, method: string, args: unknown[]) {
        const model = mixerModel(action.getMixer());
        // Three uses Infinity for unlimited loops; preserve that intentional
        // value in JSON instead of silently serializing it to null.
        const receipt = {
            actor: model.id,
            clip: action.getClip().name,
            method,
            args: args.map((value) =>
                typeof value === 'number' && !Number.isFinite(value)
                    ? { number: String(value) }
                    : value,
            ),
            at: now,
        };
        commandModels.set(receipt, model);
        if (recording) frame.commands.push(receipt);
        else pendingCommands.push(receipt);
    }
    function pairAction(action: AnimationAction) {
        if (actions.has(action) || mirroring) return;
        mirroring++;
        let expected: AnimationAction;
        try {
            expected = ensureMixer(action.getMixer()).clipAction(
                action.getClip(),
            );
        } finally {
            mirroring--;
        }
        actions.set(action, expected);
        const { uuid: _uuid, ...clip } = action.getClip().toJSON();
        newClips.set(action, JSON.stringify(clip));
        for (const key of [
            'enabled',
            'paused',
            'time',
            'timeScale',
            'weight',
            'clampWhenFinished',
            'zeroSlopeAtStart',
            'zeroSlopeAtEnd',
        ]) {
            let value: unknown = Reflect.get(action, key);
            Reflect.set(expected, key, value);
            Object.defineProperty(action, key, {
                configurable: true,
                enumerable: true,
                get: () => value,
                set: (next: unknown) => {
                    value = next;
                    if (!mirroring) {
                        Reflect.set(expected, key, next);
                        command(action, `property:${key}`, [next]);
                    }
                },
            });
        }
    }
    return {
        setModel: (
            root: Object3D,
            id: string,
            visual?: Object3D | null,
            actorRoot?: Object3D,
        ) => {
            const model = ensureModel(root);
            model.id = id;
            model.actorRoot = actorRoot ?? root;
            if (visual && !model.visual)
                model.visual = { node: visual, transform: transform(visual) };
        },
        beginFrame: (time: number, renderDelta: number, resume = false) => {
            frame = emptyFrame();
            frame.commands = pendingCommands;
            pendingCommands = [];
            recording = true;
            checkedPoses.clear();
            now = time;
            delta = renderDelta;
            resumed = resume;
        },
        recordPresence: (presence: unknown) => {
            frame.presences.push(structuredClone(presence));
        },
        recordActorRoot: (modelRoot: Object3D, actorRoot: Object3D) => {
            ensureModel(modelRoot).observedActorRoot = actorRoot;
        },
        recordSimulation: (
            step: { now: number; delta: number },
            actorRoot?: Object3D | null,
        ) => {
            if (
                !frame.simulationSteps.some(
                    ({ now }) => Math.abs(now - step.now) < 1e-9,
                )
            )
                frame.simulationSteps.push({ ...step });
            if (actorRoot && (resumed || !simulationAnchors.has(actorRoot)))
                simulationAnchors.set(actorRoot, step.now);
        },
        invoke<TArgs extends unknown[], TResult>(
            source: FaunaPoseSource,
            args: TArgs,
            actual: (...args: TArgs) => TResult,
            reference: (...args: TArgs) => TResult,
        ): TResult {
            const model = modelFromInputs(args);
            if (!model)
                throw new Error(
                    `No independent rig for ${source.file}:${source.name}`,
                );
            synchronize(model);
            inputActor = model.id;
            inputSource = `${source.file}:${source.name}`;
            const cloned = args.map((argument) => cloneInput(argument));
            // The baseline's initial meander/approach alternatives both use
            // flight targets; permit its nonnullable original body unchanged.
            if (source.name === 'updateButterflyRig') {
                const input = cloned[0];
                if (
                    typeof input === 'object' &&
                    input !== null &&
                    Reflect.get(input, 'runtime') === null
                )
                    Reflect.set(input, 'runtime', { phase: 'approaching' });
            }
            const inputs = inputReceipt(args[0]);
            const receipt =
                typeof inputs === 'object' && inputs !== null
                    ? Object.fromEntries(Object.entries(inputs))
                    : {};
            const sourceId = `${source.file}:${source.name}`;
            if (!sources.has(sourceId)) {
                sources.add(sourceId);
                frame.sources.push(source);
            }
            const suppliedTime = receipt.now ?? receipt.time;
            const delayed =
                mode === 'candidate' &&
                /^(updateCowPose|updateChickenPose|updateGoatPose|updatePigletPose|updateSheepPose)$/.test(
                    source.name,
                );
            const anchor =
                delayed && model.actorRoot
                    ? simulationAnchors.get(model.actorRoot)
                    : 0;
            if (anchor === undefined)
                throw new Error(
                    `${model.id}: missing authoritative presentation clock anchor`,
                );
            const expectedTime = delayed ? Math.max(anchor, now - 1 / 30) : now;
            if (
                typeof suppliedTime === 'number' &&
                Math.abs(suppliedTime - expectedTime) > 1e-9
            )
                throw new Error(
                    `${model.id}:${source.name} pose clock phase ${suppliedTime} expected ${expectedTime}`,
                );
            // Presentation.get advances even when culling skips the helper.
            // Derive its previous sample from the prior render, rather than
            // the prior helper call, to keep that independent clock contract.
            const previousTime = delayed
                ? Math.max(anchor, now - delta - 1 / 30)
                : now - delta;
            const snapped = delayed && Math.abs(anchor - now) < 1e-9;
            const expectedDelta = snapped
                ? Math.min(1 / 30, delta)
                : Math.min(
                      delayed ? 0.064 : Number.POSITIVE_INFINITY,
                      Math.max(0, expectedTime - previousTime),
                  );
            if (
                typeof receipt.delta === 'number' &&
                Math.abs(receipt.delta - expectedDelta) > 1e-9
            )
                throw new Error(
                    `${model.id}:${source.name} pose clock rate ${receipt.delta} expected ${expectedDelta}`,
                );
            frame.calls.push({
                actor: model.id,
                sourceId,
                inputs: receipt,
                clock: {
                    policy: delayed ? 'presentation' : 'render',
                    anchor,
                    time: expectedTime,
                    delta: expectedDelta,
                },
            });
            const result = actual(...args);
            Reflect.apply(reference, undefined, cloned);
            verify(model);
            remember(model);
            for (const argument of args) rememberInputs(argument);
            return result;
        },
        clipAction: pairAction,
        actionMethod(
            action: AnimationAction,
            method: string,
            args: unknown[],
            perform: () => unknown,
        ) {
            const expected = actions.get(action);
            if (!expected || mirroring) return perform();
            const model = mixerModel(action.getMixer());
            synchronize(model);
            command(
                action,
                method,
                args.map((argument) =>
                    argument instanceof AnimationAction
                        ? argument.getClip().name
                        : argument,
                ),
            );
            mirroring++;
            try {
                const result = perform();
                Reflect.apply(
                    Reflect.get(expected, method),
                    expected,
                    args.map((argument) =>
                        argument instanceof AnimationAction
                            ? (actions.get(argument) ?? argument)
                            : argument,
                    ),
                );
                verify(model);
                remember(model);
                return result;
            } finally {
                mirroring--;
            }
        },
        mixerMethod(
            mixer: AnimationMixer,
            method: string,
            args: unknown[],
            perform: () => unknown,
        ) {
            if (mirroring) return perform();
            const model = mixerModel(mixer);
            synchronize(model);
            const expected = ensureMixer(mixer);
            mirroring++;
            try {
                const result = perform();
                Reflect.apply(
                    Reflect.get(expected, method),
                    expected,
                    args.map((argument) =>
                        isObject3D(argument)
                            ? modelForNode(argument).nodes.get(argument)
                            : argument,
                    ),
                );
                if (method === 'update') {
                    if (Math.abs(Number(args[0]) - delta) > 1e-9)
                        throw new Error(
                            `${model.id}: mixer clock rate ${args[0]} expected ${delta}`,
                        );
                    frame.mixers.push({
                        actor: model.id,
                        delta: Number(args[0]),
                        time: mixer.time,
                    });
                }
                verify(model);
                remember(model);
                return result;
            } finally {
                mirroring--;
            }
        },
        async receipt(poses: unknown): Promise<FaunaPoseOracleFrame> {
            for (const model of models.values()) verify(model);
            for (const model of models.values()) {
                const actorRoot = model.observedActorRoot;
                if (!actorRoot) continue;
                frame.actorRoots.push({
                    actor: model.id,
                    matchesObservedParent: model.actorRoot === actorRoot,
                    local: transform(actorRoot),
                    matrixWorld: actorRoot.matrixWorld.toArray(),
                });
            }
            frame.checkedPoses = [...checkedPoses.values()];
            for (const command of frame.commands)
                command.actor = commandModels.get(command)?.id ?? command.actor;
            for (const [action, clip] of newClips) {
                const digest = await crypto.subtle.digest(
                    'SHA-256',
                    new TextEncoder().encode(clip),
                );
                frame.clips.push({
                    actor: mixerModel(action.getMixer()).id,
                    name: action.getClip().name,
                    hash: Array.from(new Uint8Array(digest), (value) =>
                        value.toString(16).padStart(2, '0'),
                    ).join(''),
                });
            }
            newClips.clear();
            const bytes = new TextEncoder().encode(JSON.stringify(poses));
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            const poseHash = Array.from(new Uint8Array(digest), (value) =>
                value.toString(16).padStart(2, '0'),
            ).join('');
            recording = false;
            return { ...frame, poseHash };
        },
    };
}

export type FaunaPoseOracle = ReturnType<typeof createFaunaPoseOracle>;
let active: FaunaPoseOracle | null = null;
let installed = false;
function installAdapters() {
    if (installed) return;
    installed = true;
    const clipAction = AnimationMixer.prototype.clipAction;
    Reflect.set(
        AnimationMixer.prototype,
        'clipAction',
        function (this: AnimationMixer, ...args: unknown[]) {
            const action: unknown = Reflect.apply(clipAction, this, args);
            if (action instanceof AnimationAction) active?.clipAction(action);
            return action;
        },
    );
    for (const method of [
        'play',
        'stop',
        'reset',
        'startAt',
        'setLoop',
        'setEffectiveWeight',
        'setEffectiveTimeScale',
        'setDuration',
        'syncWith',
        'halt',
        'warp',
        'fadeIn',
        'fadeOut',
        'crossFadeFrom',
        'crossFadeTo',
        'stopFading',
        'stopWarping',
    ]) {
        const original: unknown = Reflect.get(
            AnimationAction.prototype,
            method,
        );
        if (typeof original !== 'function')
            throw new Error(`Missing Three action method ${method}`);
        Reflect.set(
            AnimationAction.prototype,
            method,
            function (this: AnimationAction, ...args: unknown[]) {
                const perform = () => Reflect.apply(original, this, args);
                return active
                    ? active.actionMethod(this, method, args, perform)
                    : perform();
            },
        );
    }
    for (const method of [
        'update',
        'setTime',
        'stopAllAction',
        'uncacheAction',
        'uncacheClip',
        'uncacheRoot',
    ]) {
        const original: unknown = Reflect.get(AnimationMixer.prototype, method);
        if (typeof original !== 'function')
            throw new Error(`Missing Three mixer method ${method}`);
        Reflect.set(
            AnimationMixer.prototype,
            method,
            function (this: AnimationMixer, ...args: unknown[]) {
                const perform = () => Reflect.apply(original, this, args);
                return active
                    ? active.mixerMethod(this, method, args, perform)
                    : perform();
            },
        );
    }
}
export function activateFaunaPoseOracle(
    mode: 'baseline' | 'candidate' = 'candidate',
) {
    installAdapters();
    const oracle = createFaunaPoseOracle(mode);
    active = oracle;
    return {
        oracle,
        dispose: () => {
            if (active === oracle) active = null;
        },
    };
}
export function invokeFaunaPoseOracle<TArgs extends unknown[], TResult>(
    source: FaunaPoseSource,
    args: TArgs,
    actual: (...args: TArgs) => TResult,
    reference: (...args: TArgs) => TResult,
): TResult {
    return active
        ? active.invoke(source, args, actual, reference)
        : actual(...args);
}
export function recordFaunaSimulationStep(
    frame: { now: number; delta: number },
    actorRoot?: Object3D | null,
) {
    active?.recordSimulation(frame, actorRoot);
}
export function recordFaunaActorRoot(modelRoot: Object3D, actorRoot: Object3D) {
    active?.recordActorRoot(modelRoot, actorRoot);
}
