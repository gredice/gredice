import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrthographicCamera, Vector3 } from 'three';
import { getCameraHorizontalDirection } from '../atmosphereLighting';
import { resolveWeatherViewBasis } from './WeatherFrameContext';
import { resolveSwooshFlip } from './wind/windSwooshLayout';
import {
    cloudDriftRules,
    createCloudDriftTravel,
    resolveCloudDrift,
    resolveCloudDriftPx,
    resolveCloudShadowSpeed,
    resolveRainSlant,
    resolveSnowDrift,
    resolveWindClass,
    resolveWindDirectionDegrees,
    resolveWindLeafCount,
    resolveWindScreenSide,
    resolveWindSway,
    resolveWindSwooshAmount,
    resolveWindSwooshCount,
    resolveWindVector,
    stepCloudDriftTravel,
} from './windClass';

function near(actual: number, expected: number, epsilon = 1e-9) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `expected ${expected}, got ${actual}`,
    );
}

describe('wind class', () => {
    it('reads the API class from blended weather and clamps it to 0..4', () => {
        assert.equal(resolveWindClass(undefined), 0);
        assert.equal(resolveWindClass({ windSpeed: 2.4 }), 2.4);
        assert.equal(resolveWindClass({ windSpeed: 9 }), 4);
        assert.equal(resolveWindClass({ windSpeed: -1 }), 0);
        assert.equal(resolveWindClass({ windSpeed: Number.NaN }), 0);
        assert.equal(resolveWindClass({ windSpeed: null }), 0);
    });

    it('slants rain by (0.45 + 0.75 × class), 20% under reduced motion', () => {
        assert.equal(resolveRainSlant(0), 0);
        assert.equal(resolveRainSlant(0.05), 0);
        near(resolveRainSlant(1), 1.2);
        near(resolveRainSlant(2), 1.95);
        near(resolveRainSlant(2, true), 0.39);
    });

    it('drifts snow by 0.08 + 0.26 × class', () => {
        near(resolveSnowDrift(0), 0.08);
        near(resolveSnowDrift(0.8), 0.288);
        near(resolveSnowDrift(3), 0.86);
    });

    it('sways plants in proportion to the class, 30% under reduced motion', () => {
        assert.equal(resolveWindSway(0), 0);
        near(resolveWindSway(2), 0.5);
        near(resolveWindSway(4), 1);
        near(resolveWindSway(4, true), 0.3);
        assert.ok(resolveWindSway(1) > 0, 'a breezy live day sways plants');
    });

    it('counts leaves by (class − 0.8) × 3.2, none in snow or reduced motion', () => {
        assert.equal(resolveWindLeafCount(0.6, { cap: 14 }), 0);
        assert.equal(resolveWindLeafCount(3, { cap: 14 }), 7);
        assert.equal(resolveWindLeafCount(3.5, { cap: 14 }), 9);
        assert.equal(resolveWindLeafCount(4, { cap: 10 }), 10);
        assert.equal(resolveWindLeafCount(3, { cap: 0 }), 0);
        assert.equal(resolveWindLeafCount(3, { cap: 14, snowy: 0.5 }), 0);
        assert.equal(
            resolveWindLeafCount(3, { cap: 14, reducedMotion: true }),
            0,
        );
    });

    it('counts swooshes from class 1.3 up to the tier cap', () => {
        assert.equal(resolveWindSwooshCount(1.2, 4), 0);
        assert.equal(resolveWindSwooshCount(1.3, 4), 1);
        assert.equal(resolveWindSwooshCount(2.4, 4), 2);
        assert.equal(resolveWindSwooshCount(3.5, 4), 4);
        assert.equal(resolveWindSwooshCount(3.5, 2), 2);
        assert.equal(resolveWindSwooshCount(4, 1), 1);
    });

    it('fades swooshes in from class 1.3 and out with rain and snow', () => {
        assert.equal(resolveWindSwooshAmount(1.3), 0);
        assert.equal(resolveWindSwooshAmount(2.4), 1);
        near(resolveWindSwooshAmount(3, { rainy: 1 }), 0.4);
        assert.equal(resolveWindSwooshAmount(3, { snowy: 1 }), 0);
    });

    it('drifts clouds and their shadows with the class', () => {
        near(resolveCloudDriftPx(0), 16);
        near(resolveCloudDriftPx(1), 18.4);
        near(resolveCloudShadowSpeed(1), 0.21);
        near(resolveCloudShadowSpeed(1, { overcast: 1 }), 0.126);
        near(resolveCloudShadowSpeed(1, { reducedMotion: true }), 0.084);
    });

    it('reads compass and degree directions with the snow convention', () => {
        assert.equal(resolveWindDirectionDegrees('SE'), 135);
        assert.equal(resolveWindDirectionDegrees('nope'), 0);
        assert.equal(resolveWindDirectionDegrees(null), 0);
        assert.equal(resolveWindDirectionDegrees(-90), 270);
        const east = resolveWindVector(90);
        near(east.x, 1);
        near(east.z, 0, 1e-12);
        const north = resolveWindVector(0);
        near(north.z, -1);
    });

    it('reads the wind as the side of the screen it blows toward', () => {
        const right = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
        assert.equal(resolveWindScreenSide({ x: 1, z: 0 }, right), 1);
        assert.equal(resolveWindScreenSide({ x: -1, z: 0 }, right), -1);
        // Straight into or out of the view: right, like swooshes and leaves.
        assert.equal(
            resolveWindScreenSide({ x: Math.SQRT1_2, z: -Math.SQRT1_2 }, right),
            1,
        );
        assert.equal(resolveWindScreenSide({ x: -0.03, z: 0 }, right), 1);
        assert.equal(resolveWindScreenSide({ x: -0.1, z: 0 }, right), -1);
    });
});

/** The orthographic camera as the rig places it at a quarter turn. */
function rigCamera(turns: number) {
    const camera = new OrthographicCamera(-6.4, 6.4, 4, -4, 0.1, 1000);
    const toward = getCameraHorizontalDirection(turns);
    const radius = Math.hypot(100, 100);
    camera.position.set(toward.x * radius, 100, toward.z * radius);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    return camera;
}

/** Screen movement (NDC x right, y up) of a ground point moved by `step`. */
function screenStep(
    camera: OrthographicCamera,
    step: { x: number; z: number },
) {
    const from = new Vector3(0.4, 0, -0.3).project(camera);
    const to = new Vector3(0.4 + step.x, 0, -0.3 + step.z).project(camera);
    return { x: to.x - from.x, y: to.y - from.y };
}

describe('cloud drift', () => {
    const compass = [0, 45, 90, 135, 180, 225, 270, 315];

    it('moves the shadows sideways on screen toward the band at every turn', () => {
        for (let turns = 0; turns < 4; turns += 1) {
            const camera = rigCamera(turns);
            const basis = resolveWeatherViewBasis(camera.matrixWorld.elements);
            for (const windDirection of compass) {
                const drift = resolveCloudDrift({
                    right: basis.right,
                    windClass: 1,
                    windDirection,
                });
                const label = `turn ${turns}, wind ${windDirection}`;
                assert.equal(
                    Math.sign(drift.bandPxPerSecond),
                    drift.side,
                    label,
                );
                assert.equal(
                    Math.sign(drift.groundPerSecond),
                    drift.side,
                    label,
                );
                const moved = screenStep(camera, {
                    x: drift.axisX * drift.groundPerSecond,
                    z: drift.axisZ * drift.groundPerSecond,
                });
                // Same side as the band, and no up or down on screen.
                assert.equal(Math.sign(moved.x), drift.side, label);
                assert.ok(Math.abs(moved.y) < 1e-6 * Math.abs(moved.x), label);
                // The same side as rain slant, swooshes and leaves.
                assert.equal(
                    drift.side,
                    resolveSwooshFlip(
                        resolveWindVector(windDirection),
                        basis.right,
                    ),
                    label,
                );
            }
        }
    });

    it('turns with the view: a quarter turn can flip the side', () => {
        // East wind: left at the default view, right one turn on.
        const sides = [0, 1, 2, 3].map(
            (turns) =>
                resolveCloudDrift({
                    right: resolveWeatherViewBasis(
                        rigCamera(turns).matrixWorld.elements,
                    ).right,
                    windClass: 1,
                    windDirection: 90,
                }).side,
        );
        assert.deepEqual(sides, [-1, 1, 1, -1]);
    });

    it('drives the band and the shadows from one speed', () => {
        const right = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };
        for (const windClass of [0, 1, 2.5, 4]) {
            for (const overcast of [0, 0.5, 1]) {
                const drift = resolveCloudDrift({
                    overcast,
                    right,
                    windClass,
                    windDirection: 270,
                });
                const speed = resolveCloudShadowSpeed(windClass, { overcast });
                near(Math.abs(drift.groundPerSecond), speed);
                near(
                    Math.abs(drift.bandPxPerSecond),
                    speed * cloudDriftRules.bandPxPerUnit,
                );
            }
        }
        // Partly cloudy at class 1: the band's 7 px/s, shadows 0.21 u/s.
        const partly = resolveCloudDrift({
            right,
            windClass: 1,
            windDirection: 270,
        });
        near(partly.bandPxPerSecond, 7);
        near(partly.groundPerSecond, 0.21);
    });

    it('stops the band and slows the shadows under reduced motion', () => {
        const drift = resolveCloudDrift({
            reducedMotion: true,
            right: { x: 1, z: 0 },
            windClass: 1,
            windDirection: 90,
        });
        assert.equal(drift.bandPxPerSecond, 0);
        near(drift.groundPerSecond, 0.084);
    });

    it('follows the wind without an orthographic view', () => {
        const drift = resolveCloudDrift({
            right: null,
            windClass: 2,
            windDirection: 180,
        });
        near(drift.axisX, 0, 1e-12);
        near(drift.axisZ, 1);
        near(drift.groundPerSecond, 0.26);
        assert.equal(drift.bandPxPerSecond, 0);
    });

    it('keeps the travel continuous when the drift changes', () => {
        const frozen = createCloudDriftTravel();
        near(stepCloudDriftTravel(frozen, 20, 7, true), 140);
        near(stepCloudDriftTravel(frozen, 23, -7, true), -161);

        const live = createCloudDriftTravel();
        near(stepCloudDriftTravel(live, 20, 7, false), 140);
        near(stepCloudDriftTravel(live, 21, 7, false), 147);
        // The view turns and the side flips: no jump, it heads back.
        near(stepCloudDriftTravel(live, 21, -7, false), 147);
        near(stepCloudDriftTravel(live, 22, -7, false), 140);
        // A slower speed takes over from where it is.
        near(stepCloudDriftTravel(live, 24, -3, false), 134);
        // A clock that goes back never moves it backwards.
        near(stepCloudDriftTravel(live, 10, -3, false), 134);
        near(stepCloudDriftTravel(live, 11, -3, false), 131);
    });
});
