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
    timeUniform: IUniform<number>;
    uniforms: Record<string, IUniform<unknown>>;
};

export function createPrecipitationMaterial({
    fragmentShader,
    timeUniform,
    uniforms,
    vertexShader,
}: PrecipitationMaterialOptions) {
    return new ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader,
        side: DoubleSide,
        transparent: true,
        uniforms: {
            ...uniforms,
            uTime: timeUniform,
        },
        vertexShader,
    });
}
