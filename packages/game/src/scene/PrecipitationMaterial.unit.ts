import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPrecipitationMaterial } from './PrecipitationMaterial';

test('keeps the scene time uniform attached to precipitation materials', () => {
    const timeUniform = { value: 0 };
    const material = createPrecipitationMaterial({
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
        timeUniform,
        uniforms: {},
        vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
    });

    assert.equal(material.uniforms.uTime, timeUniform);

    timeUniform.value = 2.5;

    assert.equal(material.uniforms.uTime.value, 2.5);
    material.dispose();
});
