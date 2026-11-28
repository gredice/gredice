import assert from 'node:assert/strict';
import test from 'node:test';
import {
    rainStreakFragmentShader,
    rainStreakVertexShader,
} from './rainShaders';

test('streak: one analytic streak, unlit role colours, no loops', () => {
    for (const shader of [rainStreakVertexShader, rainStreakFragmentShader]) {
        assert.doesNotMatch(shader, /\b(?:for|while)\s*\(/);
        // No per-pixel hash noise.
        assert.doesNotMatch(shader, /43758|fract\(sin/);
    }
    assert.match(rainStreakFragmentShader, /uniform vec3 uHead;/);
    assert.match(rainStreakFragmentShader, /uniform vec3 uTail;/);
    assert.match(rainStreakFragmentShader, /uniform float uCoreWidthPx;/);
    // A rounded leading end, a tail that tapers to 30% and fades, a slightly
    // brighter lead; no teardrop head and no glint.
    assert.match(
        rainStreakFragmentShader,
        /mix\(1\.0, 0\.3, smoothstep\(radius, uSizePx\.y, behind\)\)/,
    );
    assert.match(
        rainStreakFragmentShader,
        /smoothstep\(0\.3 \* uSizePx\.y, uSizePx\.y, behind\)/,
    );
    assert.match(rainStreakFragmentShader, /mix\(uTail, uHead, 0\.6 \* lead\)/);
    assert.doesNotMatch(
        rainStreakFragmentShader,
        /rainTeardropMask|vUv\.x - 0\.38|along > 0\.78/,
    );
    // Role colours are linear: the shader converts them for the output.
    assert.match(rainStreakFragmentShader, /#include <colorspace_fragment>/);
    assert.match(rainStreakFragmentShader, /alpha < 0\.004\) discard/);
});

test('streak: pixel-sized quads in a view-sized field below the clouds', () => {
    assert.match(
        rainStreakVertexShader,
        /precipitationUnitsPerPixelAt\(viewCenter\)/,
    );
    assert.match(rainStreakVertexShader, /precipitationViewHalfSize\(\)/);
    assert.match(rainStreakVertexShader, /uniform vec2 uSizePx;/);
    assert.match(
        rainStreakVertexShader,
        /clamp\(viewHalf\.y \/ 4\.0, 0\.35, 2\.4\)/,
    );
    // Normalised offsets rebased on the CPU, so speed changes never jump.
    assert.match(
        rainStreakVertexShader,
        /uFallOffset \+ uFallVelocity \* elapsed/,
    );
    assert.match(
        rainStreakVertexShader,
        /uWindOffset \+ uWindVelocity \* elapsed/,
    );
    assert.match(
        rainStreakVertexShader,
        /smoothstep\(uCloudBase, uCloudFade, world\.y - uGroundY\)/,
    );
    // Each drop has its own opacity in the range.
    assert.match(
        rainStreakVertexShader,
        /mix\(uOpacityRange\.x, uOpacityRange\.y, fract\(aSeed\.w \* 7\.31\)\)/,
    );
    // The avatar views (perspective) fill a box in front of the camera.
    assert.match(
        rainStreakVertexShader,
        /bool avatarView = projectionMatrix\[3\]\[3\] < 0\.5;/,
    );
    assert.match(rainStreakVertexShader, /vec3\(14\.0, 3\.0, 9\.0\)/);
    assert.match(rainStreakVertexShader, /axisD \* \(local\.z \+ ahead\)/);
});
