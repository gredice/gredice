import * as THREE from 'three';
import { plantSwayVertexShader } from '../hooks/usePlantSway';
import type { PlantDefinition } from './plant-definition-types';

export const stemSurfaceVertexShader = /* glsl */ `
    varying vec3 vStemSurfacePosition;

    ${plantSwayVertexShader.replace(
        'void main() {',
        `
        void main() {
            vStemSurfacePosition = position;
        `,
    )}
`;

/**
 * Thinnest stem on screen, in world units. GAME_ART.md asks that no visible
 * part is thinner than 0.03 units, so every stem keeps at least this radius
 * whatever scale the plant is drawn at.
 */
export const PLANT_STEM_MIN_WORLD_RADIUS = 0.016;

export const instancedStemSurfaceVertexShader = /* glsl */ `
    attribute vec2 stemRadius;
    varying vec3 vStemSurfacePosition;

    ${plantSwayVertexShader
        .replace(
            'void main() {',
            `
        void main() {
            float stemT = clamp(position.y, 0.0, 1.0);
            float radius = mix(stemRadius.x, stemRadius.y, stemT);
            // Instance x stays unit length before the plant's own scale, so
            // this is the world size of one local radius unit.
            float stemWorldScale = max(
                length(mat3(modelMatrix) * mat3(instanceMatrix) * vec3(1.0, 0.0, 0.0)),
                0.0001
            );
            radius = radius > 0.0
                ? max(radius, ${PLANT_STEM_MIN_WORLD_RADIUS.toFixed(4)} / stemWorldScale)
                : 0.0;
            vec3 taperedPosition = vec3(position.x * radius, position.y, position.z * radius);
            vStemSurfacePosition = (instanceMatrix * vec4(taperedPosition, 1.0)).xyz;
        `,
        )
        .replace(
            'vec4 localPosition = vec4(position, 1.0);',
            'vec4 localPosition = vec4(taperedPosition, 1.0);',
        )
        // Stems breathe in girth only, so leaves stay on their nodes.
        .replace(
            'localPosition.xyz *= breathScale;',
            'localPosition.xz *= breathScale;',
        )}
`;

export const stemSurfaceFragmentShader = /* glsl */ `
    uniform vec3 uStemDetailColor;
    uniform float uStemDetailScale;
    uniform float uStemDetailStrength;

    varying vec3 vStemSurfacePosition;

    void main() {
        vec3 baseColor = csm_DiffuseColor.rgb;
        float barkWave = sin(vStemSurfacePosition.y * uStemDetailScale + vStemSurfacePosition.x * 7.0);
        float barkGroove = sin(
            atan(vStemSurfacePosition.z, vStemSurfacePosition.x) * 8.0 +
            vStemSurfacePosition.y * (uStemDetailScale * 0.38)
        );
        float barkMask = smoothstep(-0.15, 0.7, barkWave * 0.72 + barkGroove * 0.28);
        vec3 shadedColor = mix(baseColor, uStemDetailColor, barkMask * uStemDetailStrength);

        csm_DiffuseColor = vec4(shadedColor, csm_DiffuseColor.a);
    }
`;

export function createStemSurfaceUniforms(stem: PlantDefinition['stem']) {
    return {
        uStemDetailColor: {
            value: new THREE.Color(stem.detailColor ?? stem.color),
        },
        uStemDetailScale: {
            value: stem.detailScale ?? 1,
        },
        uStemDetailStrength: {
            value: stem.surface === 'bark' ? (stem.detailStrength ?? 0.3) : 0,
        },
    };
}
