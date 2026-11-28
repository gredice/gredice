import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSnowSurfaceIntegrationReadiness } from '../scene/weatherSurfaceUniforms';
import {
    canopyCapSlopeRange,
    canopyDomeSlopeRange,
    grassSettleCm,
    overlaySlopeRangeForScale,
    snowPresets,
    treeBranchUpRange,
} from './snowPresets';
import {
    lyingSnowFullCoverageCm,
    resolveSnowSettle,
    resolveSnowSettleAmountRange,
    resolveSnowSettleThickness,
    snowCoverRules,
    snowOverlayFragmentShader,
    snowOverlayVertexShader,
} from './snowShader';

test('canopy domes take one soft snow edge and caps are covered all over', () => {
    // GAME_ART.md "Weather > Snow": no green crescent on a canopy.
    assert.deepEqual(snowPresets.bushCore.slopeRange, canopyDomeSlopeRange);
    assert.deepEqual(
        snowPresets.treeCanopyInner.slopeRange,
        canopyDomeSlopeRange,
    );
    assert.deepEqual(snowPresets.bushFoliage.slopeRange, canopyCapSlopeRange);
    // The cap reaches below the horizon; the dome stops above it.
    assert.ok(canopyCapSlopeRange[1] < 0);
    assert.ok(canopyDomeSlopeRange[0] > 0);
    // Ground presets keep the slope exponent.
    assert.equal('slopeRange' in snowPresets.grassFlat, false);
});

test('the overlay switches to the slope range and grows along normals', () => {
    assert.match(snowOverlayVertexShader, /uniform vec3 uSlopeRange;/);
    assert.match(
        snowOverlayVertexShader,
        /slopeCoverage = mix\(slopeCoverage, slopeRangeCover, uSlopeRange\.z\)/,
    );
    assert.match(snowOverlayVertexShader, /\(1\.0 - uSlopeRange\.z\)/);
});

test('grass settles more slowly than paths: a light dusting from 2 cm, whole by 3.5 cm', () => {
    // GAME_ART.md "Weather > Snow": below about 1 cm grass stays green, at
    // 2 cm it takes a light see-through dusting and by 3.5 cm the full
    // cover. Pins moved (2026-11-25 audit): with the range ending at 5 cm
    // the 2 cm dusting was about 30% and read as a paler summer lawn next to
    // white paths on the farm; ending at 3.5 cm gives about half at 2 cm.
    const grass = [
        snowPresets.grassFlat,
        snowPresets.grassAngle,
        snowPresets.grassCorner,
        snowPresets.grassReverseCorner,
    ];
    for (const preset of grass) {
        assert.deepEqual(preset.settleCm, grassSettleCm);
        const range = resolveSnowSettleAmountRange(
            preset.settleCm,
            preset.coverageMultiplier,
        );
        const settleAt = (cm: number) =>
            resolveSnowSettle(
                (cm / lyingSnowFullCoverageCm) * preset.coverageMultiplier,
                range,
            );
        assert.equal(settleAt(0.5), 0);
        assert.ok(settleAt(1) < 0.2);
        assert.ok(settleAt(2) > 0.45 && settleAt(2) < 0.55);
        assert.ok(settleAt(3) > 0.8 && settleAt(3) < 0.86);
        assert.equal(settleAt(3.5), 1);
        assert.equal(settleAt(5), 1);
        // The dusting is whole before the integrated ground snow can take
        // the tile over or the overlay turns opaque, so neither pops and
        // melting runs the same way back.
        assert.equal(
            resolveSnowSurfaceIntegrationReadiness({
                amount: range[1] - 0.001,
                noiseInfluence: 0.15,
                wasReady: true,
            }),
            false,
        );
        assert.ok(range[1] < snowCoverRules.opaqueFrom);
    }
    // Paths, roofs and props keep the shared ramp alone.
    for (const key of ['sand', 'snow', 'stone', 'tool', 'pine'] as const) {
        assert.equal('settleCm' in snowPresets[key], false);
    }
    assert.equal(resolveSnowSettle(0.05, undefined), 1);
});

test('a settling dusting lies flat, then thickens by the end of its settle range', () => {
    assert.match(snowOverlayFragmentShader, /uniform vec2 uSnowSettle;/);
    assert.match(snowOverlayFragmentShader, /alpha \*= clamp\(/);
    // Pin moved: the flat dusting used to stay flat for the whole blend
    // phase (below opaqueFrom, 6 cm on flat grass), so grass that was
    // already white at 4.5 to 5.4 cm had no thickness (a green line along
    // verges) and the integrated ground snow raised it in one step at
    // 5.4 cm. Now it thickens over the last part of the settle range.
    assert.match(
        snowOverlayVertexShader,
        /displacementAmount \*= smoothstep\(\s*mix\(\s*uSnowSettle\.x,\s*uSnowSettle\.y,\s*0\.800\s*\),\s*uSnowSettle\.y,\s*uSnowAmount\s*\);/,
    );
    assert.doesNotMatch(snowOverlayVertexShader, /uSnowBlend/);
    const grass = snowPresets.grassFlat;
    const range = resolveSnowSettleAmountRange(
        grass.settleCm,
        grass.coverageMultiplier,
    );
    const amountAt = (cm: number) =>
        (cm / lyingSnowFullCoverageCm) * grass.coverageMultiplier;
    const thicknessAt = (cm: number) =>
        resolveSnowSettleThickness(amountAt(cm), range);
    // Flat while clearly see-through (no joint lines at 1 to 2.8 cm).
    // Pins moved with the settle range (now 0.5 to 3.5 cm): the thickness
    // ramp is the last 20% of it, about 2.9 to 3.5 cm.
    for (const cm of [1, 2, 2.5, 2.8]) assert.equal(thicknessAt(cm), 0);
    // Rising through the end of the dusting, whole at 3.5 cm, well before
    // the integrated ground snow takes flat grass over (5.4 cm).
    assert.ok(thicknessAt(3.2) > 0.2 && thicknessAt(3.2) < 0.8);
    assert.equal(thicknessAt(3.5), 1);
    assert.equal(thicknessAt(5), 1);
    assert.equal(thicknessAt(5.4), 1);
    let previous = 0;
    for (let cm = 0; cm <= 6; cm += 0.1) {
        const value = thicknessAt(cm);
        assert.ok(value >= previous);
        previous = value;
    }
    // Every other preset keeps its thickness at once.
    assert.equal(resolveSnowSettleThickness(0.05, undefined), 1);
});

test('bare tree branches take snow only on faces near up, at the tree scale', () => {
    // A uniform scale leaves the range as it is.
    const same = overlaySlopeRangeForScale([0.5, 0.8], 1, 1);
    assert.ok(Math.abs(same[0] - 0.5) < 1e-9);
    assert.ok(Math.abs(same[1] - 0.8) < 1e-9);
    // At 0.125 wide and 0.5 tall a 45 degree face reads 16 times flatter.
    const [squashed] = overlaySlopeRangeForScale([Math.SQRT1_2, 1], 0.125, 0.5);
    assert.ok(Math.abs(squashed - 1 / Math.sqrt(1 + 1 / 256)) < 1e-9);
    assert.deepEqual(
        snowPresets.treeBranches.slopeRange,
        overlaySlopeRangeForScale(treeBranchUpRange, 0.125, 0.5),
    );
    // Tips and the tops of the less steep branches are covered; a steep
    // branch's upper side and its sides never are. Pin moved (2026-11-25
    // audit): full cover used to reach 63 degrees from up, so on the snowy
    // farm a white band ran down each steep branch, matched the ground
    // behind it and split the branch lengthwise. Now full cover stops near
    // 50 degrees and fades out by about 70.
    const degrees = (up: number) => (Math.acos(up) * 180) / Math.PI;
    assert.ok(degrees(treeBranchUpRange[1]) > 45);
    assert.ok(degrees(treeBranchUpRange[1]) < 55);
    assert.ok(degrees(treeBranchUpRange[0]) < 72);
    assert.ok(treeBranchUpRange[0] > 0);
});
