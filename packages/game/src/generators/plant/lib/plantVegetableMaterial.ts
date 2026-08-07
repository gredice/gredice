import { plantSwayVertexShader } from '../hooks/usePlantSway';

export const vegetableColorVertexShader = /* glsl */ `
    attribute vec3 vegetableInstanceColor;
    varying vec3 vVegetableInstanceColor;

    ${plantSwayVertexShader.replace(
        'void main() {',
        `
        void main() {
            vVegetableInstanceColor = vegetableInstanceColor;
        `,
    )}
`;

export const vegetableColorFragmentShader = /* glsl */ `
    varying vec3 vVegetableInstanceColor;

    void main() {
        csm_DiffuseColor = vec4(vVegetableInstanceColor, 1.0);
    }
`;
