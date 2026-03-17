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
