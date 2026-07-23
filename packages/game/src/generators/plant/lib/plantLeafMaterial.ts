import { plantSwayVertexShader } from '../hooks/usePlantSway';

export const leafColorVertexShader = /* glsl */ `
    attribute vec3 leafInstanceColor;
    varying vec3 vLeafInstanceColor;

    ${plantSwayVertexShader.replace(
        'void main() {',
        `
        void main() {
            vLeafInstanceColor = leafInstanceColor;
        `,
    )}
`;

export const leafColorFragmentShader = /* glsl */ `
    varying vec3 vLeafInstanceColor;

    void main() {
        csm_DiffuseColor = vec4(vLeafInstanceColor, 1.0);
    }
`;
