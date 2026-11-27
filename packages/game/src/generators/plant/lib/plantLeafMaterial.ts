import { plantSwayVertexShader } from '../hooks/usePlantSway';
import { PLANT_FOLIAGE_UP_BEND } from './plantPartRendering';

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

/**
 * Leaf colour from the instance attribute, lit through a normal bent toward
 * world up by `PLANT_FOLIAGE_UP_BEND`. `csm_FragNormal` arrives as the view
 * space geometry normal, already flipped on back faces; the second column of
 * the view matrix is world up in view space.
 */
export const leafColorFragmentShader = /* glsl */ `
    varying vec3 vLeafInstanceColor;

    void main() {
        csm_DiffuseColor = vec4(vLeafInstanceColor, 1.0);
        csm_FragNormal = normalize(
            csm_FragNormal +
            normalize(viewMatrix[1].xyz) * ${PLANT_FOLIAGE_UP_BEND.toFixed(3)}
        );
    }
`;
