import {
    DoubleSide,
    MeshStandardMaterial,
    type MeshStandardMaterialParameters,
} from 'three';

/**
 * How far a loose leaf's shading normal bends toward world up, 0 to 1.
 * Enough that a leaf seen edge-on or from behind still lights close to a
 * sunlit top; the rest of its real normal keeps a little flicker as it
 * tumbles.
 */
export const autumnLeafNormalBend = 0.75;

/**
 * Material for loose leaves in the air: falling leaves, gusts and the leaf
 * raking puff. A leaf is a thin double-sided card that tumbles, so lit with
 * its real normal it mostly turns a side or its back to the key light and
 * reads as a dark brown fleck. Bending the shading normal toward up lights
 * it like the canopy it fell from, so it shows its gold, amber, orange or
 * red role colour (GAME_ART "Seasonal roles"). Satin, like the canopies.
 */
export function createAutumnLeafMaterial(
    parameters: MeshStandardMaterialParameters = {},
) {
    const material = new MeshStandardMaterial({
        side: DoubleSide,
        roughness: 0.55,
        ...parameters,
    });
    material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <normal_fragment_begin>',
            `#include <normal_fragment_begin>
normal = normalize(mix(
    normal,
    normalize(viewMatrix[1].xyz),
    ${autumnLeafNormalBend.toFixed(2)}
));`,
        );
    };
    material.customProgramCacheKey = () => 'gredice-autumn-leaf-up-normal';
    return material;
}
