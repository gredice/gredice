import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
import { resolveAtmosphereFog } from '../../atmosphereLighting';

test('the depth fog stays a light, nearly even tint; the back haze softens the back', () => {
    const fog = resolveAtmosphereFog({
        cameraDistance: 173.2,
        foggy: 1,
        horizonColor: new Color('#c8d8ec'),
    });
    assert.ok(fog);
    const share = (depth: number) =>
        Math.min(1, Math.max(0, (depth - fog.near) / (fog.far - fog.near)));
    const centre = share(173.2);
    assert.ok(centre > 0 && centre < 0.1, `centre ${centre}`);
    // The back corner of a 25 × 25 farm is about 14 units deeper than its
    // centre; it must not fog over with depth (GAME_ART: back haze by screen
    // height, the same at any garden size).
    const back = share(173.2 + 14);
    assert.ok(back - centre < 0.06, `back ${back} vs centre ${centre}`);
});
