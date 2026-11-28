import {
    DoubleSide,
    type IUniform,
    ShaderMaterial,
    type ShaderMaterialParameters,
} from 'three';

type PrecipitationMaterialOptions = Pick<
    ShaderMaterialParameters,
    'fragmentShader' | 'vertexShader'
> & {
    /**
     * Rain and snow are depth-tested (GAME_ART.md "Weather > Three layers"):
     * a drop or flake behind a bed, plant or animal is hidden by it, so
     * chunky particles never paint over the garden.
     */
    depthTest?: boolean;
    timeUniform: IUniform<number>;
    uniforms: Record<string, IUniform<unknown>>;
    /**
     * The view's height in CSS pixels as `uViewHeightPx`, so a vertex shader
     * can size particles in pixels with `precipitationPixelSizeChunk`.
     */
    viewHeightPxUniform?: IUniform<number>;
};

/**
 * World units per CSS pixel at a particle, for a vertex shader that sizes
 * particles in pixels: read from the projection matrix, so it follows a zoom
 * as it animates. `precipitationUnitsPerPixelAt(viewPosition)` also works
 * in a perspective (avatar) camera, from the particle's depth, so a drop
 * keeps its pixel size near and far. Without a view height it falls back to
 * the default zoom of 100 pixels per unit.
 */
export const precipitationPixelSizeChunk = /* glsl */ `
    uniform float uViewHeightPx;

    float precipitationUnitsPerPixel() {
        if (projectionMatrix[3][3] > 0.5 && uViewHeightPx > 0.5) {
            return 2.0 / (projectionMatrix[1][1] * uViewHeightPx);
        }
        return 0.01;
    }

    float precipitationUnitsPerPixelAt(vec4 viewPosition) {
        if (projectionMatrix[3][3] > 0.5) {
            return precipitationUnitsPerPixel();
        }
        if (uViewHeightPx > 0.5) {
            return 2.0 * max(0.05, -viewPosition.z) / (projectionMatrix[1][1] * uViewHeightPx);
        }
        return 0.01;
    }

    vec2 precipitationViewHalfSize() {
        if (projectionMatrix[3][3] > 0.5) {
            return vec2(1.0 / projectionMatrix[0][0], 1.0 / projectionMatrix[1][1]);
        }
        return vec2(7.0, 4.0);
    }
`;

export function createPrecipitationMaterial({
    depthTest = true,
    fragmentShader,
    timeUniform,
    uniforms,
    vertexShader,
    viewHeightPxUniform,
}: PrecipitationMaterialOptions) {
    return new ShaderMaterial({
        depthTest,
        depthWrite: false,
        fragmentShader,
        side: DoubleSide,
        transparent: true,
        uniforms: {
            ...uniforms,
            ...(viewHeightPxUniform
                ? { uViewHeightPx: viewHeightPxUniform }
                : {}),
            uTime: timeUniform,
        },
        vertexShader,
    });
}
