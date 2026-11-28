import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    BoxGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    ShaderLib,
    ShaderMaterial,
    type Texture,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import { patchAutumnPropWindShader } from './autumnPropWind';
import { retainCloudShadowAttenuationMaterial } from './cloudShadowAttenuation';
import {
    bindIdleBreathingMaterial,
    bindIdleBreathingSubtree,
    createIdleBreathingMaterial,
    createIdleBreathingUniforms,
    createIdleBreathingWorldUniforms,
    getIdleBreathingEntity,
    getIdleBreathingEntityRole,
    getIdleBreathingInstancedRole,
    getIdleBreathingPartsPivot,
    getIdleBreathingPivot,
    hasIdleBreathingOverlay,
    idleBreathingAmplitudeRange,
    idleBreathingAmplitudes,
    idleBreathingApplyLine,
    idleBreathingPeriod,
    idleBreathingPeriodSeconds,
    idleBreathingRestoreLine,
    idleBreathingScale,
    idleBreathingSeed,
    idleBreathingVertexShaderChunk,
    idleBreathingWave,
    idleBreathingWorldProjectBlock,
    idleBreathingWorldVertexShaderChunk,
    patchIdleBreathingVertexShader,
    patchIdleBreathingWorldVertexShader,
    releaseIdleBreathingSubtree,
    resolveIdleBreathingAmplitude,
} from './idleBreathing';

test('every breathing role stays inside the GAME_ART stretch range', () => {
    for (const amplitude of Object.values(idleBreathingAmplitudes)) {
        assert.ok(amplitude >= idleBreathingAmplitudeRange.min);
        assert.ok(amplitude <= idleBreathingAmplitudeRange.max);
    }
});

test('a breath lasts about four seconds and each tile has its own phase', () => {
    let neighbours = 0;
    let apart = 0;
    let total = 0;
    for (let x = -12; x <= 12; x++) {
        for (let z = -12; z <= 12; z++) {
            const seed = idleBreathingSeed(x, z);
            assert.ok(seed >= 0 && seed < 1);
            total += seed;
            const period = idleBreathingPeriod(seed);
            assert.ok(period >= idleBreathingPeriodSeconds * 0.9 - 1e-9);
            assert.ok(period <= idleBreathingPeriodSeconds * 1.1 + 1e-9);
            const next = idleBreathingSeed(x + 1, z);
            const distance = Math.abs(seed - next);
            neighbours++;
            if (Math.min(distance, 1 - distance) > 0.05) apart++;
        }
    }
    // Phases spread over the whole cycle and neighbours rarely breathe in step.
    assert.ok(Math.abs(total / neighbours - 0.5) < 0.05);
    assert.ok(apart / neighbours > 0.8);
    // Dragging a block within its tile keeps the phase.
    assert.equal(idleBreathingSeed(3.2, -4.4), idleBreathingSeed(3, -4));
    assert.notEqual(idleBreathingSeed(3, -4), idleBreathingSeed(4, -4));
});

test('the breath wave is periodic and bounded', () => {
    const seed = idleBreathingSeed(2, 7);
    const period = idleBreathingPeriod(seed);
    for (let t = 0; t < 30; t += 0.37) {
        const wave = idleBreathingWave(t, seed);
        assert.ok(wave >= -1 && wave <= 1);
        assert.ok(Math.abs(idleBreathingWave(t + period, seed) - wave) < 1e-9);
    }
    assert.equal(idleBreathingWave(Number.NaN, seed), 0);
    assert.equal(idleBreathingWave(Number.POSITIVE_INFINITY, seed), 0);
});

test('breathing preserves volume like the placement squash', () => {
    for (const amplitude of Object.values(idleBreathingAmplitudes)) {
        for (const wave of [-1, -0.5, 0, 0.5, 1]) {
            const { side, up } = idleBreathingScale(amplitude, wave);
            assert.ok(Math.abs(up - 1) <= amplitude + 1e-12);
            // (1 + b)(1 - b / 2)^2 = 1 - 3b^2/4 + b^3/4.
            assert.ok(Math.abs(side * side * up - 1) < 0.001);
        }
    }
    assert.deepEqual(idleBreathingScale(Number.NaN, 1), { side: 1, up: 1 });
});

test('living things hold still for reduced motion, captures and snow', () => {
    const role = 'canopy';
    assert.equal(
        resolveIdleBreathingAmplitude({ reducedMotion: false, role }),
        idleBreathingAmplitudes.canopy,
    );
    assert.equal(
        resolveIdleBreathingAmplitude({ reducedMotion: true, role }),
        0,
    );
    assert.equal(
        resolveIdleBreathingAmplitude({
            fixedTime: true,
            reducedMotion: false,
            role,
        }),
        0,
    );
    assert.equal(
        resolveIdleBreathingAmplitude({
            enabled: false,
            reducedMotion: false,
            role,
        }),
        0,
    );
    assert.equal(
        resolveIdleBreathingAmplitude({ reducedMotion: false, role: 'animal' }),
        idleBreathingAmplitudes.animal,
    );
    assert.equal(
        resolveIdleBreathingAmplitude({ reducedMotion: true, role: 'animal' }),
        0,
    );
});

test('one breath every four seconds swings the full stretch range', () => {
    // Sampled over one period, the stretch reaches both peaks and the
    // quarter-period points sit a quarter cycle apart.
    const seed = idleBreathingSeed(5, -3);
    const period = idleBreathingPeriod(seed);
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (let step = 0; step <= 400; step++) {
        const { up } = idleBreathingScale(
            idleBreathingAmplitudes.canopy,
            idleBreathingWave((step / 400) * period, seed),
        );
        low = Math.min(low, up);
        high = Math.max(high, up);
    }
    assert.ok(Math.abs(high - (1 + idleBreathingAmplitudes.canopy)) < 1e-4);
    assert.ok(Math.abs(low - (1 - idleBreathingAmplitudes.canopy)) < 1e-4);
    assert.ok(period > 3.5 && period < 4.5);
});

test('a canopy breathes from the centre of its base', () => {
    const geometry = new BoxGeometry(2, 1, 4).translate(1, 2.5, -1);
    const pivot = getIdleBreathingPivot(geometry);
    assert.deepEqual(pivot.toArray(), [1, 2, -1]);
});

test('living components breathe about the point they stand on', () => {
    assert.equal(getIdleBreathingEntityRole('Rose'), 'flower');
    assert.equal(getIdleBreathingEntityRole('PalmTree'), 'tall-plant');
    assert.equal(getIdleBreathingEntityRole('SeasonalMaple'), 'tall-plant');
    assert.equal(getIdleBreathingEntityRole('PineAdvent'), 'tall-plant');
    assert.equal(getIdleBreathingEntityRole('AutumnShrub'), 'shrub');
    assert.equal(getIdleBreathingEntityRole('Sunflower'), 'tall-plant');
    // The sheep has no rig, so the whole model breathes.
    assert.equal(getIdleBreathingEntityRole('Sheep'), 'animal');
    // Instanced canopies breathe in their shader instead.
    assert.equal(getIdleBreathingEntityRole('Tree'), undefined);
    assert.equal(getIdleBreathingEntityRole('Bush'), undefined);
    // Props do not breathe, and animals breathe in their own rigs.
    assert.equal(getIdleBreathingEntityRole('Raised_Bed'), undefined);
    assert.equal(getIdleBreathingEntityRole('Rabbit'), undefined);
    assert.equal(getIdleBreathingEntityRole('toString'), undefined);
});

test('a flower pot breathes with its flowers only, from their base', () => {
    const pot = getIdleBreathingEntity('AutumnAsterPotMauve');
    assert.equal(pot?.role, 'flower');
    assert.deepEqual(pot?.parts, [
        'AutumnAsterPot_Centers',
        'AutumnAsterPot_Foliage',
        'AutumnAsterPot_Petals',
    ]);
    const parts = pot?.parts ?? [];
    const root = new Group();
    root.position.set(3, 1, -2);
    const potMesh = new Mesh(
        new BoxGeometry(0.56, 0.22, 0.56).translate(0, 0.11, 0),
        new MeshStandardMaterial(),
    );
    potMesh.name = 'AutumnAsterPot_Pot';
    const foliage = new Mesh(
        new BoxGeometry(0.56, 0.35, 0.52).translate(0, 0.345, 0),
        new MeshStandardMaterial(),
    );
    foliage.name = 'AutumnAsterPot_Foliage';
    root.add(potMesh, foliage);
    root.updateMatrixWorld(true);

    const pivot = getIdleBreathingPartsPivot(root, parts, new Vector3());
    assert.ok(pivot);
    assert.ok(Math.abs(pivot.x - 3) < 1e-6);
    assert.ok(Math.abs(pivot.y - 1.17) < 1e-6);
    assert.ok(Math.abs(pivot.z + 2) < 1e-6);
    assert.equal(
        getIdleBreathingPartsPivot(new Group(), parts, new Vector3()),
        null,
    );

    const potMaterial = potMesh.material;
    const foliageMaterial = foliage.material;
    bindIdleBreathingSubtree(
        root,
        createIdleBreathingWorldUniforms({ value: 0 }),
        new Map(),
        new WeakSet(),
        parts,
    );
    assert.equal(potMesh.material, potMaterial);
    assert.notEqual(foliage.material, foliageMaterial);
});

test('instanced living blocks breathe in their batch material', () => {
    assert.equal(getIdleBreathingInstancedRole('Pine'), 'tall-plant');
    assert.equal(getIdleBreathingInstancedRole('Tulip'), 'flower');
    // Trees and bushes breathe in their canopy batch only, not the trunk.
    assert.equal(getIdleBreathingInstancedRole('Tree'), undefined);
    assert.equal(getIdleBreathingInstancedRole('Bush'), undefined);
    assert.equal(getIdleBreathingInstancedRole('StoneSmall'), undefined);
    assert.equal(getIdleBreathingInstancedRole('toString'), undefined);
    // A block breathes in one place only.
    for (const name of ['Pine', 'Tulip'])
        assert.equal(getIdleBreathingEntityRole(name), undefined);
});

test('the shader patch breathes after begin_vertex and composes with wind', () => {
    const standard = ShaderLib.standard.vertexShader;
    const patched = patchIdleBreathingVertexShader(standard);
    assert.ok(patched.includes(idleBreathingVertexShaderChunk));
    const begin = patched.indexOf('#include <begin_vertex>');
    const breathe = patched.indexOf(idleBreathingApplyLine);
    const project = patched.indexOf('#include <project_vertex>');
    const restore = patched.indexOf(idleBreathingRestoreLine);
    const world = patched.indexOf('#include <worldpos_vertex>');
    const shadow = patched.indexOf('#include <shadowmap_vertex>');
    // Only the projected position breathes: shadow-map lookups and other
    // world-position chunks see the rest surface the shadow map was drawn from.
    assert.ok(begin >= 0 && begin < breathe && breathe < project);
    assert.ok(project < restore && restore < world && world < shadow);
    // The shader keeps the same period as the JavaScript timing.
    assert.ok(
        idleBreathingVertexShaderChunk.includes(
            idleBreathingPeriodSeconds.toFixed(4),
        ),
    );
    assert.equal(patchIdleBreathingVertexShader(patched), patched);

    const windy = patchAutumnPropWindShader(patched, 'grass');
    const breatheInWind = windy.indexOf(idleBreathingApplyLine);
    const wind = windy.indexOf('transformed += autumnWindOffset(position);');
    assert.ok(breatheInWind >= 0 && wind >= 0);
    assert.throws(() => patchIdleBreathingVertexShader('void main() {}'));
});

test('binding composes earlier hooks and unbinding restores them', () => {
    const material = new MeshStandardMaterial();
    const calls: string[] = [];
    material.onBeforeCompile = () => {
        calls.push('earlier');
    };
    material.customProgramCacheKey = () => 'earlier-key';
    const earlierCompile = material.onBeforeCompile;
    const earlierKey = material.customProgramCacheKey;
    const time = { value: 12 };
    const uniforms = createIdleBreathingUniforms(time, new Vector3(0, 1, 0));
    const unbind = bindIdleBreathingMaterial(material, uniforms);

    const shader = {
        fragmentShader: ShaderLib.standard.fragmentShader,
        uniforms: {},
        vertexShader: ShaderLib.standard.vertexShader,
    };
    Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);
    assert.deepEqual(calls, ['earlier']);
    assert.equal(
        Reflect.get(shader.uniforms, 'grediceIdleBreathTime'),
        uniforms.grediceIdleBreathTime,
    );
    assert.ok(shader.vertexShader.includes('grediceIdleBreath( transformed )'));
    assert.match(material.customProgramCacheKey(), /^earlier-key\|/);

    unbind();
    assert.equal(material.onBeforeCompile, earlierCompile);
    assert.equal(material.customProgramCacheKey, earlierKey);
});

test('a batch breathes on its own copy of the shared model material', () => {
    const shared = new MeshStandardMaterial({ color: 'red', roughness: 0.4 });
    const windHook = () => {};
    shared.onBeforeCompile = windHook;
    const uniforms = createIdleBreathingUniforms({ value: 0 });
    const copy = createIdleBreathingMaterial(shared, uniforms);
    assert.notEqual(copy, shared);
    assert.ok(copy instanceof MeshStandardMaterial);
    assert.equal(copy.color.getHexString(), 'ff0000');
    assert.equal(copy.roughness, 0.4);
    assert.notEqual(copy.onBeforeCompile, windHook);
    assert.equal(shared.onBeforeCompile, windHook);
    assert.equal(
        shared.customProgramCacheKey,
        MeshStandardMaterial.prototype.customProgramCacheKey,
    );
    // Wrapped in a breathing entity, it does not breathe a second time.
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(), copy);
    root.add(mesh);
    bindIdleBreathingSubtree(
        root,
        createIdleBreathingWorldUniforms({ value: 0 }),
        new Map(),
        new WeakSet(),
    );
    assert.equal(mesh.material, copy);
});

test('entities breathe in world space and keep the rest surface for shadows', () => {
    const standard = ShaderLib.standard.vertexShader;
    const patched = patchIdleBreathingWorldVertexShader(standard);
    assert.ok(patched.includes(idleBreathingWorldVertexShaderChunk));
    const project = patched.indexOf('#include <project_vertex>');
    const breathe = patched.indexOf(idleBreathingWorldProjectBlock);
    const world = patched.indexOf('#include <worldpos_vertex>');
    // The projected position is replaced after project_vertex; `transformed`
    // is never written, so world-position chunks see the rest surface.
    assert.ok(project >= 0 && project < breathe && breathe < world);
    assert.ok(!idleBreathingWorldProjectBlock.includes('transformed ='));
    assert.ok(!idleBreathingWorldProjectBlock.includes('transformed +='));
    assert.ok(
        idleBreathingWorldVertexShaderChunk.includes(
            idleBreathingPeriodSeconds.toFixed(4),
        ),
    );
    assert.equal(patchIdleBreathingWorldVertexShader(patched), patched);
    // Custom overlay shaders are left alone instead of throwing.
    assert.equal(
        patchIdleBreathingWorldVertexShader('void main() {}'),
        'void main() {}',
    );
});

test('an entity binds its own copies of shared materials and gives them back', () => {
    const shared = new MeshStandardMaterial({ color: 'red' });
    const sharedHook = () => {};
    shared.onBeforeCompile = sharedHook;
    const owned = new MeshStandardMaterial({ color: 'green' });
    // react-three-fiber marks materials it creates from JSX.
    Reflect.set(owned, '__r3f', {});
    const overlay = new ShaderMaterial();
    // A cached GLTF material attached with <primitive /> is marked as well,
    // but stays shared.
    const primitive = new MeshStandardMaterial({ color: 'blue' });
    Reflect.set(primitive, '__r3f', { type: 'primitive' });
    const sepal = new Mesh(new BoxGeometry(), primitive);
    const root = new Group();
    const first = new Mesh(new BoxGeometry(), shared);
    const second = new Mesh(new BoxGeometry(), shared);
    const leaves = new Mesh(new BoxGeometry(), owned);
    const snow = new Mesh(new BoxGeometry(), overlay);
    root.add(first, second, leaves, snow, sepal);
    const uniforms = createIdleBreathingWorldUniforms({ value: 0 });
    const bindings = new Map();
    const bound = new WeakSet<MeshStandardMaterial>();

    bindIdleBreathingSubtree(root, uniforms, bindings, bound);
    // A shared material is copied once per entity; the copy keeps its hooks.
    assert.notEqual(first.material, shared);
    assert.equal(first.material, second.material);
    assert.ok(first.material instanceof MeshStandardMaterial);
    assert.equal(first.material.color.getHexString(), 'ff0000');
    assert.notEqual(first.material.onBeforeCompile, sharedHook);
    // An element's own material is patched in place, so its props stay live.
    assert.equal(leaves.material, owned);
    assert.notEqual(
        owned.onBeforeCompile,
        MeshStandardMaterial.prototype.onBeforeCompile,
    );
    // Custom overlays keep their own material.
    assert.equal(snow.material, overlay);
    assert.notEqual(sepal.material, primitive);
    assert.equal(
        primitive.onBeforeCompile,
        MeshStandardMaterial.prototype.onBeforeCompile,
    );
    // The shared material itself is untouched.
    assert.equal(shared.onBeforeCompile, sharedHook);

    // Binding again is a no-op; a new material on a mesh is picked up.
    const copy = first.material;
    bindIdleBreathingSubtree(root, uniforms, bindings, bound);
    assert.equal(first.material, copy);
    const replacement = new MeshStandardMaterial();
    second.material = replacement;
    bindIdleBreathingSubtree(root, uniforms, bindings, bound);
    assert.notEqual(second.material, replacement);
    assert.notEqual(second.material, copy);

    releaseIdleBreathingSubtree(root, bindings);
    assert.equal(first.material, shared);
    assert.equal(second.material, replacement);
    assert.equal(leaves.material, owned);
    assert.equal(sepal.material, primitive);
    assert.equal(
        owned.onBeforeCompile,
        MeshStandardMaterial.prototype.onBeforeCompile,
    );
    assert.equal(bindings.size, 0);
});

test('a breathing copy of a cloud-shaded material gets the cloud shader once', () => {
    const cloudUniforms = {
        bounds: { value: new Vector4() },
        hardness: { value: 0 },
        map: { value: null as Texture | null },
        projection: { value: new Vector2() },
        strength: { value: 0 },
    };
    const compile = (material: MeshStandardMaterial) => {
        const shader = {
            fragmentShader: ShaderLib.standard.fragmentShader,
            uniforms: {},
            vertexShader: ShaderLib.standard.vertexShader,
        };
        Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);
        const count = (source: string, needle: string) =>
            source.split(needle).length - 1;
        return {
            breath: count(shader.vertexShader, 'grediceIdleBreath'),
            cloud: count(
                shader.vertexShader,
                'varying vec3 vGrediceCloudShadowWorldPosition;',
            ),
        };
    };
    const windHook = () => {};
    const time = { value: 0 };

    // Instanced route: the cloud layer patched the shared model material
    // first, then decorates the breathing copy it finds in the scene.
    const shared = new MeshStandardMaterial();
    shared.onBeforeCompile = windHook;
    retainCloudShadowAttenuationMaterial(shared, cloudUniforms);
    const copy = createIdleBreathingMaterial(
        shared,
        createIdleBreathingUniforms(time),
    );
    assert.ok(copy instanceof MeshStandardMaterial);
    assert.equal(compile(copy).cloud, 0);
    retainCloudShadowAttenuationMaterial(copy, cloudUniforms);
    assert.equal(compile(copy).cloud, 1);
    assert.ok(compile(copy).breath > 0);
    assert.equal(
        copy.customProgramCacheKey().split('gredice-cloud-shadow').length - 1,
        1,
    );

    // World route: a shared GLTF material on an entity mesh.
    const gltf = new MeshStandardMaterial();
    retainCloudShadowAttenuationMaterial(gltf, cloudUniforms);
    const mesh = new Mesh(new BoxGeometry(), gltf);
    const root = new Group();
    root.add(mesh);
    bindIdleBreathingSubtree(
        root,
        createIdleBreathingWorldUniforms(time),
        new Map(),
        new WeakSet(),
    );
    const bound = mesh.material;
    assert.ok(bound instanceof MeshStandardMaterial);
    assert.notEqual(bound, gltf);
    retainCloudShadowAttenuationMaterial(bound, cloudUniforms);
    assert.equal(compile(bound).cloud, 1);
    assert.ok(compile(bound).breath > 0);
});

test('a plant under a weather overlay holds still', () => {
    const root = new Group();
    const plant = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    root.add(plant);
    assert.equal(hasIdleBreathingOverlay(root), false);
    const snow = new Mesh(new BoxGeometry(), new ShaderMaterial());
    plant.add(snow);
    assert.equal(hasIdleBreathingOverlay(root), true);
    snow.visible = false;
    assert.equal(hasIdleBreathingOverlay(root), false);
    snow.visible = true;
    snow.material.visible = false;
    assert.equal(hasIdleBreathingOverlay(root), false);
});
