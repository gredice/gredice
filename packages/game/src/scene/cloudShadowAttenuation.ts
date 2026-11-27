import {
    Color,
    type IUniform,
    type Material,
    type Object3D,
    Vector2,
    Vector4,
    type WebGLRenderer,
} from 'three';

/**
 * Cloud shadows (GAME_ART.md "Weather > Cloud shadows"): a separate layer of
 * soft ellipses over the garden, not tied to the visible clouds. Every lit
 * material projects its fragment along the key light to the ground and
 * tests the ellipses; under a shadow all its light, the fill included
 * (decision D2), is multiplied toward the shadow tint. A shadow never goes
 * darker than the tint.
 *
 * The model is a blend between the unshadowed and the fully shadowed light,
 * so the static opaque cache's two captures (no response, full response)
 * reproduce it in its replay shader.
 */
const CLOUD_SHADOW_SHADER_CACHE_KEY = 'gredice-cloud-shadow-ellipses-v1';
const CLOUD_SHADOW_MAX_PROJECTION_SLOPE = 1.5;

/** The most ellipses any tier draws (GAME_ART: 6 / 4 / 0). */
export const cloudShadowEllipseCapacity = 6;

const cloudShadowVertexPars = /* glsl */ `
varying vec3 vGrediceCloudShadowWorldPosition;
`;

const cloudShadowVertex = /* glsl */ `
#include <worldpos_vertex>

#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined( USE_SHADOWMAP ) || defined( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
    vGrediceCloudShadowWorldPosition = worldPosition.xyz;
#else
    vec4 grediceCloudShadowWorldPosition = vec4( transformed, 1.0 );

    #ifdef USE_BATCHING
        grediceCloudShadowWorldPosition = batchingMatrix * grediceCloudShadowWorldPosition;
    #endif

    #ifdef USE_INSTANCING
        grediceCloudShadowWorldPosition = instanceMatrix * grediceCloudShadowWorldPosition;
    #endif

    vGrediceCloudShadowWorldPosition = ( modelMatrix * grediceCloudShadowWorldPosition ).xyz;
#endif
`;

/**
 * The ellipse uniforms and the shadow function, shared by lit materials and
 * the static cache replay. `grediceCloudShadowAmount(world.xz, world.y)`
 * returns the share of the tint (0 to 1) at a world position.
 */
export const cloudShadowEllipseFunction = /* glsl */ `
uniform vec4 grediceCloudShadowEllipses[ ${cloudShadowEllipseCapacity} ];
uniform float grediceCloudShadowAmounts[ ${cloudShadowEllipseCapacity} ];
uniform vec2 grediceCloudShadowAxis;
uniform vec3 grediceCloudShadowTint;
uniform vec2 grediceCloudShadowProjection;
uniform float grediceCloudShadowStrength;
uniform float grediceCloudShadowCapture;

float grediceCloudShadowAmount(
    vec2 grediceCloudShadowWorldXz,
    float grediceCloudShadowWorldY
) {
    vec2 grediceCloudShadowGround =
        grediceCloudShadowWorldXz -
        grediceCloudShadowProjection * grediceCloudShadowWorldY;
    vec2 grediceCloudShadowAcross =
        vec2( -grediceCloudShadowAxis.y, grediceCloudShadowAxis.x );
    float grediceCloudShadowShare = grediceCloudShadowCapture;
    for ( int i = 0; i < ${cloudShadowEllipseCapacity}; i++ ) {
        vec4 grediceCloudShadowEllipse = grediceCloudShadowEllipses[ i ];
        vec2 grediceCloudShadowOffset =
            grediceCloudShadowGround - grediceCloudShadowEllipse.xy;
        vec2 grediceCloudShadowLocal = vec2(
            dot( grediceCloudShadowOffset, grediceCloudShadowAxis ),
            dot( grediceCloudShadowOffset, grediceCloudShadowAcross )
        ) / max( grediceCloudShadowEllipse.zw, vec2( 0.0001 ) );
        // A solid core inside half the radius, a soft edge to the radius.
        grediceCloudShadowShare = max(
            grediceCloudShadowShare,
            grediceCloudShadowAmounts[ i ] *
                ( 1.0 - smoothstep( 0.5, 1.0, length( grediceCloudShadowLocal ) ) )
        );
    }
    return clamp( grediceCloudShadowShare * grediceCloudShadowStrength, 0.0, 1.0 );
}
`;

const cloudShadowFragmentPars = /* glsl */ `
${cloudShadowEllipseFunction}
varying vec3 vGrediceCloudShadowWorldPosition;
`;

export const cloudShadowFragmentShaderChunk = /* glsl */ `
#include <aomap_fragment>

vec3 grediceCloudShadowAttenuation = vec3( 1.0 );
if ( grediceCloudShadowStrength > 0.001 ) {
    grediceCloudShadowAttenuation = mix(
        vec3( 1.0 ),
        grediceCloudShadowTint,
        grediceCloudShadowAmount(
            vGrediceCloudShadowWorldPosition.xz,
            vGrediceCloudShadowWorldPosition.y
        )
    );
}

reflectedLight.directDiffuse *= grediceCloudShadowAttenuation;
reflectedLight.directSpecular *= grediceCloudShadowAttenuation;
reflectedLight.indirectDiffuse *= grediceCloudShadowAttenuation;
reflectedLight.indirectSpecular *= grediceCloudShadowAttenuation;
`;

export type CloudShadowProjection = {
    x: number;
    z: number;
};

/**
 * The shared uniform set. Each entry binds as `grediceCloudShadow<Name>`
 * in the patched shaders.
 */
export type CloudShadowMaterialUniforms = {
    /** Per ellipse: centre x and z, radius along and across the axis. */
    ellipses: IUniform<Vector4[]>;
    /** Per ellipse: share of the tint at its core, 0 to 1. */
    amounts: IUniform<number[]>;
    /** Unit XZ direction of the ellipses' long axis (the drift axis). */
    axis: IUniform<Vector2>;
    /** Light under a full shadow is multiplied by this colour (linear). */
    tint: IUniform<Color>;
    /** Ground projection along the key light: x / y and z / y. */
    projection: IUniform<Vector2>;
    /** Master strength; 0 skips the shadow entirely. */
    strength: IUniform<number>;
    /** 1 shades everything as fully shadowed (the static cache capture). */
    capture: IUniform<number>;
    /** 1 while a shadow layer drives the uniforms with materials patched. */
    active: IUniform<number>;
};

/**
 * Any uniform table the decorator binds by name. Shared scene materials use
 * `getCloudShadowAttenuationMaterialUniforms()`; tests and fixtures may pass
 * their own.
 */
export type CloudShadowUniformTable = Readonly<Record<string, IUniform>>;

type CloudShadowMaterialPatchState = {
    consumerCount: number;
    originalCustomProgramCacheKey: Material['customProgramCacheKey'];
    originalOnBeforeCompile: Material['onBeforeCompile'];
    patchedCustomProgramCacheKey: Material['customProgramCacheKey'];
    patchedOnBeforeCompile: Material['onBeforeCompile'];
};

export type CloudShadowMaterialLease = {
    material: Material;
    release: () => void;
};

export type CloudShadowMaterialLeaseMap = Map<string, CloudShadowMaterialLease>;

const materialPatchStates = new WeakMap<
    Material,
    CloudShadowMaterialPatchState
>();
const registeredMaterialCandidateTokens = new Map<
    Material,
    Map<symbol, Object3D | undefined>
>();
let registeredMaterialCandidateRevision = 0;

export function createCloudShadowMaterialUniforms(): CloudShadowMaterialUniforms {
    return {
        ellipses: {
            value: Array.from(
                { length: cloudShadowEllipseCapacity },
                () => new Vector4(0, 0, 1, 1),
            ),
        },
        amounts: {
            value: Array.from({ length: cloudShadowEllipseCapacity }, () => 0),
        },
        axis: { value: new Vector2(1, 0) },
        tint: { value: new Color(1, 1, 1) },
        projection: { value: new Vector2() },
        strength: { value: 0 },
        capture: { value: 0 },
        active: { value: 0 },
    };
}

// The production garden owns one active weather scene, so one stable uniform
// set lets shared materials keep a single compiled program across transitions.
// Concurrent weather scenes with different shadows would contend for these
// values and would need renderer- or scene-scoped uniforms.
const sharedCloudShadowMaterialUniforms = createCloudShadowMaterialUniforms();

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

/** The GLSL name a uniform table entry binds to. */
export function getCloudShadowUniformBindingName(key: string) {
    return `grediceCloudShadow${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

/** Whether a shadow layer currently drives the shared uniforms. */
export function isCloudShadowLayerActive(
    uniforms: Pick<CloudShadowMaterialUniforms, 'active'>,
) {
    return uniforms.active.value > 0.5;
}

export function getCloudShadowAttenuationMaterialUniforms() {
    return sharedCloudShadowMaterialUniforms;
}

/**
 * Dynamic materials can announce their lifecycle without owning the cloud
 * shader decorator. The cloud layer observes the revision before rendering,
 * patches new candidates with its current uniforms, and releases disappeared
 * candidates on the same frame instead of waiting for the periodic scene
 * traversal.
 */
export function registerCloudShadowAttenuationMaterialCandidate(
    material: Material,
    root?: Object3D,
) {
    const token = Symbol(material.uuid);
    const tokens =
        registeredMaterialCandidateTokens.get(material) ??
        new Map<symbol, Object3D | undefined>();
    tokens.set(token, root);
    registeredMaterialCandidateTokens.set(material, tokens);
    registeredMaterialCandidateRevision += 1;

    let registered = true;
    return () => {
        if (!registered) {
            return;
        }
        registered = false;
        const activeTokens = registeredMaterialCandidateTokens.get(material);
        activeTokens?.delete(token);
        if (activeTokens?.size === 0) {
            registeredMaterialCandidateTokens.delete(material);
        }
        registeredMaterialCandidateRevision += 1;
    };
}

export function getCloudShadowAttenuationMaterialCandidateRevision() {
    return registeredMaterialCandidateRevision;
}

/**
 * Material clones do not carry compile callbacks automatically. Consumers
 * that deliberately compose a new callback must also avoid copying this
 * scene-owned decorator: the cloud layer will discover and decorate the clone
 * itself. Returning the pre-cloud hooks prevents duplicate shader injection.
 */
export function getMaterialShaderHooksWithoutCloudShadowAttenuation(
    material: Material,
) {
    const state = materialPatchStates.get(material);
    return {
        customProgramCacheKey:
            state?.originalCustomProgramCacheKey ??
            material.customProgramCacheKey,
        onBeforeCompile:
            state?.originalOnBeforeCompile ?? material.onBeforeCompile,
    };
}

export function resolveCloudShadowAttenuationActivation({
    activated,
    strength,
}: {
    activated: boolean;
    strength: number;
}) {
    return activated || (Number.isFinite(strength) && strength > 0.001);
}

export function resolveCloudShadowProjection({
    x,
    y,
    z,
}: {
    x: number;
    y: number;
    z: number;
}): CloudShadowProjection {
    if (!Number.isFinite(y) || y <= 0.001) {
        return { x: 0, z: 0 };
    }

    return {
        x: clamp(
            x / y,
            -CLOUD_SHADOW_MAX_PROJECTION_SLOPE,
            CLOUD_SHADOW_MAX_PROJECTION_SLOPE,
        ),
        z: clamp(
            z / y,
            -CLOUD_SHADOW_MAX_PROJECTION_SLOPE,
            CLOUD_SHADOW_MAX_PROJECTION_SLOPE,
        ),
    };
}

export function projectCloudShadowReceiverToGround(
    position: { x: number; y: number; z: number },
    projection: CloudShadowProjection,
) {
    return {
        x: position.x - projection.x * position.y,
        z: position.z - projection.z * position.y,
    };
}

function hasMaterialFlag(material: Material, flag: string) {
    return Reflect.get(material, flag) === true;
}

export function supportsCloudShadowAttenuation(material: Material) {
    // Built-in lit materials share the reflected-light shader contract above.
    // ShaderMaterial receivers need an explicit output integration and are
    // intentionally left unchanged instead of guessing at their uniforms.
    return (
        hasMaterialFlag(material, 'isMeshStandardMaterial') ||
        hasMaterialFlag(material, 'isMeshPhysicalMaterial') ||
        hasMaterialFlag(material, 'isMeshLambertMaterial') ||
        hasMaterialFlag(material, 'isMeshPhongMaterial') ||
        hasMaterialFlag(material, 'isMeshToonMaterial')
    );
}

function isMaterial(value: unknown): value is Material {
    return (
        typeof value === 'object' &&
        value !== null &&
        Reflect.get(value, 'isMaterial') === true
    );
}

function getObjectMaterials(object: Object3D) {
    const value = Reflect.get(object, 'material');
    if (Array.isArray(value)) {
        return value.filter(isMaterial);
    }

    return isMaterial(value) ? [value] : [];
}

function injectCloudShadowAttenuationShader(
    shader: Parameters<Material['onBeforeCompile']>[0],
    uniforms: CloudShadowUniformTable,
) {
    for (const [key, uniform] of Object.entries(uniforms)) {
        shader.uniforms[getCloudShadowUniformBindingName(key)] = uniform;
    }

    const weatherWorldPositionAvailable =
        shader.vertexShader.includes(
            'varying vec3 vGrediceWeatherWorldPosition;',
        ) &&
        shader.fragmentShader.includes(
            'varying vec3 vGrediceWeatherWorldPosition;',
        );
    if (!weatherWorldPositionAvailable) {
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>\n${cloudShadowVertexPars}`,
            )
            .replace('#include <worldpos_vertex>', cloudShadowVertex);
    }
    const fragmentPars = weatherWorldPositionAvailable
        ? cloudShadowEllipseFunction
        : cloudShadowFragmentPars;
    const fragmentChunk = weatherWorldPositionAvailable
        ? cloudShadowFragmentShaderChunk.replaceAll(
              'vGrediceCloudShadowWorldPosition',
              'vGrediceWeatherWorldPosition',
          )
        : cloudShadowFragmentShaderChunk;
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${fragmentPars}`)
        .replace('#include <aomap_fragment>', fragmentChunk);
}

/** Three keeps a material's latest uniform table when returning to a cached program.
 * A base-only compile can replace that table; restore only this decorator's bindings.
 */
function refreshCloudShadowMaterialUniforms(
    material: Material,
    uniforms: CloudShadowUniformTable,
    renderer: Pick<WebGLRenderer, 'properties'> | undefined,
) {
    const properties: unknown = renderer?.properties.get(material);
    if (
        typeof properties !== 'object' ||
        properties === null ||
        Array.isArray(properties)
    )
        return;
    const table: unknown = Reflect.get(properties, 'uniforms');
    if (typeof table !== 'object' || table === null || Array.isArray(table))
        return;
    for (const [key, uniform] of Object.entries(uniforms)) {
        Reflect.set(table, getCloudShadowUniformBindingName(key), uniform);
    }
}

export function retainCloudShadowAttenuationMaterial(
    material: Material,
    uniforms: CloudShadowUniformTable,
    renderer?: Pick<WebGLRenderer, 'properties'>,
): CloudShadowMaterialLease {
    refreshCloudShadowMaterialUniforms(material, uniforms, renderer);
    const existingState = materialPatchStates.get(material);
    if (existingState) {
        existingState.consumerCount += 1;
        let released = false;
        return {
            material,
            release: () => {
                if (released) {
                    return;
                }
                released = true;
                releaseCloudShadowAttenuationMaterial(material);
            },
        };
    }

    const originalOnBeforeCompile = material.onBeforeCompile;
    const originalCustomProgramCacheKey = material.customProgramCacheKey;
    const patchedOnBeforeCompile: Material['onBeforeCompile'] = (
        shader,
        renderer,
    ) => {
        originalOnBeforeCompile.call(material, shader, renderer);
        injectCloudShadowAttenuationShader(shader, uniforms);
    };
    const patchedCustomProgramCacheKey: Material['customProgramCacheKey'] =
        () =>
            `${originalCustomProgramCacheKey.call(material)}|${CLOUD_SHADOW_SHADER_CACHE_KEY}`;
    const state = {
        consumerCount: 1,
        originalCustomProgramCacheKey,
        originalOnBeforeCompile,
        patchedCustomProgramCacheKey,
        patchedOnBeforeCompile,
    };
    materialPatchStates.set(material, state);
    material.onBeforeCompile = patchedOnBeforeCompile;
    material.customProgramCacheKey = patchedCustomProgramCacheKey;
    material.needsUpdate = true;

    let released = false;
    return {
        material,
        release: () => {
            if (released) {
                return;
            }
            released = true;
            releaseCloudShadowAttenuationMaterial(material);
        },
    };
}

function releaseCloudShadowAttenuationMaterial(material: Material) {
    const state = materialPatchStates.get(material);
    if (!state) {
        return;
    }

    state.consumerCount = Math.max(0, state.consumerCount - 1);
    if (state.consumerCount > 0) {
        return;
    }

    if (material.onBeforeCompile === state.patchedOnBeforeCompile) {
        material.onBeforeCompile = state.originalOnBeforeCompile;
    }
    if (material.customProgramCacheKey === state.patchedCustomProgramCacheKey) {
        material.customProgramCacheKey = state.originalCustomProgramCacheKey;
    }
    material.needsUpdate = true;
    materialPatchStates.delete(material);
}

export function syncCloudShadowAttenuationMaterials({
    enabled,
    leases,
    root,
    uniforms,
    renderer,
}: {
    enabled: boolean;
    leases: CloudShadowMaterialLeaseMap;
    root: Object3D;
    uniforms: CloudShadowUniformTable;
    renderer?: Pick<WebGLRenderer, 'properties'>;
}) {
    const activeMaterialIds = new Set<string>();

    if (enabled) {
        const activateMaterial = (material: Material) => {
            if (!supportsCloudShadowAttenuation(material)) {
                return;
            }

            activeMaterialIds.add(material.uuid);
            if (!leases.has(material.uuid)) {
                leases.set(
                    material.uuid,
                    retainCloudShadowAttenuationMaterial(
                        material,
                        uniforms,
                        renderer,
                    ),
                );
            } else {
                refreshCloudShadowMaterialUniforms(
                    material,
                    uniforms,
                    renderer,
                );
            }
        };

        for (const [material, tokens] of registeredMaterialCandidateTokens) {
            if (
                [...tokens.values()].some(
                    (owner) => owner === undefined || owner === root,
                )
            )
                activateMaterial(material);
        }
        root.traverse((object) => {
            for (const material of getObjectMaterials(object)) {
                activateMaterial(material);
            }
        });
    }

    for (const [materialId, lease] of leases) {
        if (activeMaterialIds.has(materialId)) {
            continue;
        }

        lease.release();
        leases.delete(materialId);
    }

    return leases.size;
}

export function releaseCloudShadowAttenuationMaterials(
    leases: CloudShadowMaterialLeaseMap,
) {
    for (const lease of leases.values()) {
        lease.release();
    }
    leases.clear();
}

/**
 * Cloud shadow numbers from GAME_ART.md "Weather > Cloud shadows". One
 * place to tune them.
 */
export const cloudShadowRules = {
    /** Shadows partly cloudy shows; overcast shows the tier's cap. */
    partlyCount: 3,
    /** Radius in world units, partly cloudy to overcast. */
    radius: [1.65, 2.05],
    /** Per-shadow size and width-to-length jitter. */
    sizeJitter: [0.85, 1.15],
    aspect: [0.66, 0.8],
    /** Lanes across the drift axis: at least this far apart. */
    laneSpacing: 2.4,
    /**
     * On a field wider than the target island the three lanes spread over
     * this share of the half extent across the drift axis.
     */
    laneSpreadShare: 0.6,
    /** Fade in and out over this distance at the field's ends. */
    edgeFade: 1.4,
    /** Shadows travel this far past the field before they wrap. */
    travelMargin: 1.65,
    /** Cloud cover that brings shadows in, and overcast for count/size. */
    coverRamp: [0.08, 0.3],
    overcastRamp: [0.55, 0.9],
    /** Fog removes the shadows. */
    fogRamp: [0.2, 0.7],
    /**
     * Strength multipliers: overcast, heavy rain, full snow. Overcast is
     * 0.9 here, not the target's 0.72: the game's lighting answers a shadow
     * more softly, and 0.9 brings the garden's mean luminance drop under
     * overcast from about 7.7% toward the target's 11% (partly cloudy keeps
     * its 4%).
     */
    overcastStrength: 0.9,
    heavyRainStrength: 0.8,
    fullSnowStrength: 0.65,
} as const;

/** The ground area the shadows travel over, in world units. */
export type CloudShadowField = {
    centreX: number;
    centreZ: number;
    /** Half the field's extent along and across the drift axis. */
    halfAlong: number;
    halfAcross: number;
};

export type CloudShadowWeather = {
    cloudy: number;
    foggy: number;
    rainy: number;
    snowy: number;
};

type Vec4Like = { set: (x: number, y: number, z: number, w: number) => void };

function lerp(from: number, to: number, amount: number) {
    return from + (to - from) * amount;
}

function smoothstepRange(edge0: number, edge1: number, value: number) {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function seededShadowRandom(seed: number) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}

/** Stable per-shadow jitter (no runtime randomness). */
export const cloudShadowSeeds = Array.from(
    { length: cloudShadowEllipseCapacity },
    (_, index) => ({
        along: seededShadowRandom(index * 7.31 + 1.7),
        size: lerp(
            cloudShadowRules.sizeJitter[0],
            cloudShadowRules.sizeJitter[1],
            seededShadowRandom(index * 7.31 + 3.9),
        ),
        aspect: lerp(
            cloudShadowRules.aspect[0],
            cloudShadowRules.aspect[1],
            seededShadowRandom(index * 7.31 + 5.3),
        ),
    }),
);

/** How overcast the shadows behave, 0 (partly cloudy) to 1 (overcast). */
export function resolveCloudShadowOvercast(cloudy: number) {
    return smoothstepRange(
        cloudShadowRules.overcastRamp[0],
        cloudShadowRules.overcastRamp[1],
        cloudy,
    );
}

/** Shadows that move over the garden: three when partly cloudy, the cap under overcast. */
export function resolveCloudShadowCount(cloudy: number, cap: number) {
    const capped = Math.max(0, Math.min(cloudShadowEllipseCapacity, cap));
    return Math.round(
        lerp(
            Math.min(cloudShadowRules.partlyCount, capped),
            capped,
            resolveCloudShadowOvercast(cloudy),
        ),
    );
}

/**
 * Share of the shadow tint at a shadow's core: the time of day's strength
 * (0.85 midday, 0.7 sunset, 0.5 night, from the roles), ×0.9 under
 * overcast, ×0.8 in heavy rain, ×0.65 at full snow, gone in fog and under
 * a clear sky.
 */
export function resolveCloudShadowStrength(
    weather: CloudShadowWeather,
    timeStrength: number,
) {
    const rules = cloudShadowRules;
    const overcast = resolveCloudShadowOvercast(weather.cloudy);
    const cover =
        smoothstepRange(
            rules.coverRamp[0],
            rules.coverRamp[1],
            weather.cloudy,
        ) *
        (1 -
            smoothstepRange(rules.fogRamp[0], rules.fogRamp[1], weather.foggy));
    return (
        clamp(timeStrength, 0, 1) *
        lerp(1, rules.overcastStrength, overcast) *
        (1 - (1 - rules.heavyRainStrength) * clamp(weather.rainy, 0, 1)) *
        (1 - (1 - rules.fullSnowStrength) * clamp(weather.snowy, 0, 1)) *
        cover
    );
}

/**
 * One lap of the shadows' travel in world units: the field along the axis
 * and the margin past each end.
 */
export function resolveCloudShadowLap(field: CloudShadowField) {
    return 2 * Math.max(1, field.halfAlong + cloudShadowRules.travelMargin);
}

/**
 * Places the shadows once they have run `laps` laps of the field along the
 * axis: three lanes across it, a second shadow in a lane half a lap behind
 * the first so sunny gaps pass between them, each fading in and out at the
 * field's ends. Counting laps rather than units keeps them in place when
 * the field changes with the axis. Writes `ellipses` (centre x and z,
 * radius along and across the axis) and `amounts`; returns how many shadows
 * show.
 */
export function resolveCloudShadowEllipses({
    amounts,
    axis,
    count,
    ellipses,
    field,
    laps,
    overcast,
    strength,
}: {
    amounts: number[];
    /** Unit XZ axis the shadows travel along (`resolveCloudDrift`). */
    axis: { x: number; z: number };
    count: number;
    ellipses: readonly Vec4Like[];
    field: CloudShadowField;
    /**
     * Laps of the field run along the axis, signed: negative runs back
     * (`stepCloudDriftTravel` at the drift over `resolveCloudShadowLap`).
     */
    laps: number;
    /** `resolveCloudShadowOvercast(cloudy)`. */
    overcast: number;
    /** `resolveCloudShadowStrength`. */
    strength: number;
}) {
    const rules = cloudShadowRules;
    const lap = resolveCloudShadowLap(field);
    const span = lap / 2;
    const laneSpacing = Math.max(
        rules.laneSpacing,
        field.halfAcross * rules.laneSpreadShare,
    );
    const acrossX = -axis.z;
    const acrossZ = axis.x;
    const radius = lerp(rules.radius[0], rules.radius[1], overcast);
    let visible = 0;
    for (let index = 0; index < ellipses.length; index += 1) {
        const ellipse = ellipses[index];
        const seed = cloudShadowSeeds[index % cloudShadowSeeds.length];
        if (!ellipse || !seed) continue;
        if (index >= count || strength <= 0) {
            amounts[index] = 0;
            continue;
        }
        const lane = index % 3;
        const round = Math.floor(index / 3);
        const travelled = lane * 0.37 + round * 0.5 + seed.along * 0.12 + laps;
        const along = (((travelled % 1) + 1) % 1) * lap - span;
        const across = (lane - 1) * laneSpacing + (seed.along - 0.5) * 0.4;
        const size = radius * seed.size;
        ellipse.set(
            field.centreX + axis.x * along + acrossX * across,
            field.centreZ + axis.z * along + acrossZ * across,
            size,
            size * seed.aspect,
        );
        const fade = smoothstepRange(
            span,
            span - rules.edgeFade,
            Math.abs(along),
        );
        const amount = clamp(strength * fade, 0, 1);
        amounts[index] = amount;
        if (amount > 0.02) visible += 1;
    }
    return visible;
}
