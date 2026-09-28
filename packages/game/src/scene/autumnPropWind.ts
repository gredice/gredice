import { autumnEntranceSway } from '@gredice/js/autumnEntrances';
import { autumnGrassWind } from '@gredice/js/autumnGrasses';
import type { IUniform, Material, Vector2 } from 'three';
import { SeededRNG } from '../generators/plant/lib/rng';
import type { GameQualityProfileTier } from './gameQuality';

export type AutumnPropWindRole =
    | 'grass'
    | 'seed-heads'
    | 'wreath'
    | 'garland'
    | 'scarf';

export function resolveAutumnPropWindStrength({
    tier,
    speed,
    snow,
    enabled,
    reducedMotion,
}: {
    tier: GameQualityProfileTier;
    speed: number;
    snow: number;
    enabled: boolean;
    reducedMotion: boolean;
}) {
    if (
        !enabled ||
        reducedMotion ||
        tier === 'low' ||
        tier === 'auto-constrained' ||
        !Number.isFinite(speed) ||
        !Number.isFinite(snow)
    )
        return 0;
    // Snow-loaded foliage is still. Strong wind never increases the reserve.
    return (
        Math.min(1, Math.max(0, speed) / 3) *
        (1 - Math.min(1, Math.max(0, snow) * 4))
    );
}

export function createAutumnPropWindUniforms(
    time: IUniform<number>,
    strength: IUniform<number>,
    direction: IUniform<Vector2>,
    seed: string,
) {
    return {
        uAutumnWindTime: time,
        uAutumnWindStrength: strength,
        uAutumnWindDirection: direction,
        uAutumnWindPhase: {
            value: new SeededRNG(seed).nextRange(0, Math.PI * 2),
        },
    };
}

export type AutumnPropWindBinding = {
    role: AutumnPropWindRole;
    uniforms: ReturnType<typeof createAutumnPropWindUniforms>;
};

const glslPoint = (point: readonly number[]) =>
    `vec3(${point.map((value) => value.toFixed(6)).join(',')})`;

function weightShader(role: AutumnPropWindRole) {
    if (role === 'grass' || role === 'seed-heads') {
        return `return ${autumnGrassWind.maxDisplacement} * smoothstep(
            ${autumnGrassWind.rootHeight}, ${role === 'grass' ? '0.32' : '0.66'}, p.y);`;
    }
    if (role === 'scarf') {
        // Authored Patch mesh: only the loose scarf island, below its collar.
        // Patches, hat band, shirt, straw, face and structural wood stay fixed.
        return `return 0.018 * step(0.85, p.y) * step(p.y, 1.025)
            * step(-0.14, p.x) * step(p.x, -0.01) * step(p.z, -0.10)
            * (1.0 - smoothstep(0.87, 1.02, p.y));`;
    }
    const profile =
        autumnEntranceSway[
            role === 'wreath' ? 'AutumnWreathPost' : 'AutumnGarland'
        ];
    const distance = profile.roots
        .map((root) => `distance(p, ${glslPoint(root)})`)
        .reduce((a, b) => `min(${a}, ${b})`);
    return `return ${profile.maxDisplacement} * smoothstep(0.0, 0.25, ${distance});`;
}

/** Analytic local weights also work on snow's generated skirt vertices. */
export function autumnPropWindShader(role: AutumnPropWindRole) {
    return `
uniform float uAutumnWindTime;
uniform float uAutumnWindStrength;
uniform float uAutumnWindPhase;
uniform vec2 uAutumnWindDirection;
float autumnWindWeight(vec3 p) { ${weightShader(role)} }
vec3 autumnWindOffset(vec3 p) {
    if (uAutumnWindStrength <= 0.0) return vec3(0.0);
    float t = uAutumnWindTime;
    float wave = 0.7 * sin(t * 1.15 + uAutumnWindPhase)
        + 0.3 * sin(t * 0.63 + uAutumnWindPhase * 1.7);
    vec3 localWind = normalize(transpose(mat3(modelMatrix)) *
        vec3(uAutumnWindDirection.x, 0.0, uAutumnWindDirection.y));
    return localWind * (autumnWindWeight(p) * uAutumnWindStrength * wave);
}
`;
}

export function patchAutumnPropWindShader(
    vertexShader: string,
    role: AutumnPropWindRole,
) {
    const standard = '#include <begin_vertex>';
    const rain = 'vec4 localPos = vec4(position, 1.0);';
    const snow = 'vec4 transformedPosition = vec4(transformed, 1.0);';
    let patched: string;
    if (vertexShader.includes(standard)) {
        patched = vertexShader.replace(
            standard,
            `${standard}\ntransformed += autumnWindOffset(position);`,
        );
    } else if (vertexShader.includes(rain)) {
        patched = vertexShader.replace(
            rain,
            'vec4 localPos = vec4(position + autumnWindOffset(position), 1.0);',
        );
    } else if (vertexShader.includes(snow)) {
        patched = vertexShader.replace(
            snow,
            `transformed += autumnWindOffset(position);\n${snow}`,
        );
    } else {
        throw new Error('Unsupported autumn prop wind vertex shader');
    }
    return autumnPropWindShader(role) + patched;
}

/** Call only for owned materials; GLTF cache materials must never be patched. */
export function bindAutumnPropWindMaterial(
    material: Material,
    binding: AutumnPropWindBinding,
) {
    const previousCompile = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    const key = previousKey.call(material);
    material.onBeforeCompile = (shader, renderer) => {
        previousCompile.call(material, shader, renderer);
        Object.assign(shader.uniforms, binding.uniforms);
        shader.vertexShader = patchAutumnPropWindShader(
            shader.vertexShader,
            binding.role,
        );
    };
    material.customProgramCacheKey = () =>
        `${key}:autumn-prop-wind:${binding.role}:1`;
    material.userData.autumnPropWind = binding;
    material.needsUpdate = true;
    return () => {
        material.onBeforeCompile = previousCompile;
        material.customProgramCacheKey = previousKey;
        delete material.userData.autumnPropWind;
        material.needsUpdate = true;
    };
}
