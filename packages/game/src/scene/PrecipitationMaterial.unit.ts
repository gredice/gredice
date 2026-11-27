import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector2 } from 'three';
import {
    createPrecipitationMaterial,
    precipitationPixelSizeChunk,
} from './PrecipitationMaterial';

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

test('keeps custom precipitation uniform references attached', () => {
    const windOffsetUniform = { value: new Vector2() };
    const material = createPrecipitationMaterial({
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
        timeUniform: { value: 0 },
        uniforms: { uWindOffset: windOffsetUniform },
        vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
    });

    assert.equal(material.uniforms.uWindOffset, windOffsetUniform);

    windOffsetUniform.value.set(2, -3);

    assert.equal(material.uniforms.uWindOffset.value.x, 2);
    assert.equal(material.uniforms.uWindOffset.value.y, -3);
    material.dispose();
});

test('rain and snow are depth-tested unless a caller opts out', () => {
    const base = {
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
        timeUniform: { value: 0 },
        uniforms: {},
        vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
    };
    const tested = createPrecipitationMaterial(base);
    assert.equal(tested.depthTest, true);
    assert.equal(tested.depthWrite, false);
    assert.equal(tested.transparent, true);
    const legacy = createPrecipitationMaterial({ ...base, depthTest: false });
    assert.equal(legacy.depthTest, false);
    tested.dispose();
    legacy.dispose();
});

test('attaches the view height uniform for pixel-sized particles', () => {
    const viewHeightPxUniform = { value: 800 };
    const material = createPrecipitationMaterial({
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
        timeUniform: { value: 0 },
        uniforms: {},
        vertexShader: `${precipitationPixelSizeChunk}
void main() { gl_Position = vec4(position * precipitationUnitsPerPixel(), 1.0); }`,
        viewHeightPxUniform,
    });
    assert.equal(material.uniforms.uViewHeightPx, viewHeightPxUniform);
    // Orthographic: 2 / (projection[1][1] × height); a perspective (avatar)
    // camera scales by the particle's depth, so a drop keeps its pixel size
    // near and far; without a view height it falls back to 100 px per unit.
    assert.match(
        precipitationPixelSizeChunk,
        /2\.0 \/ \(projectionMatrix\[1\]\[1\] \* uViewHeightPx\)/,
    );
    assert.match(
        precipitationPixelSizeChunk,
        /2\.0 \* max\(0\.05, -viewPosition\.z\) \/ \(projectionMatrix\[1\]\[1\] \* uViewHeightPx\)/,
    );
    assert.match(precipitationPixelSizeChunk, /return 0\.01;/);
    material.dispose();
});
