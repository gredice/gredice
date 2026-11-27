import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createSkyObstacles,
    emptySkyObstacles,
    rectHitsPolygon,
    rectsOverlap,
    type ViewRect,
} from '../skyLayout';
import {
    calmPlantWind,
    countPlantSwayTargets,
    getPlantWind,
    type PlantSwayUniforms,
    plantSwayReducedShare,
    registerPlantSwayTarget,
    resolvePlantMotion,
    resolvePlantSwayUniformValues,
    setPlantWind,
    subscribePlantWindMotion,
} from './plantWind';
import { windLeafPalettes } from './windLeafPalette';
import {
    findNextSwooshStart,
    findSwooshSpot,
    resolveDrawingSwooshes,
    resolveSwooshCycle,
    resolveSwooshCycleStart,
    resolveSwooshFlip,
    resolveSwooshRect,
    resolveSwooshScale,
    type SwooshSpotInput,
    swooshLookAheadCycles,
    windSwooshRules,
} from './windSwooshLayout';

const part = {
    amplitude: 0.02,
    speed: 1.4,
    breathAmplitude: 0.03,
    breathSpeed: 1.5,
    reducedMotion: false,
};

function uniforms(): PlantSwayUniforms {
    return {
        uSwayAmplitude: { value: 0 },
        uSwaySpeed: { value: 0 },
        uWindStrength: { value: 0 },
        uWindDirection: { value: [1, 0] },
        uBreathAmplitude: { value: 0 },
        uBreathSpeed: { value: 0 },
    };
}

describe('plant wind', () => {
    it('sways in proportion to the live wind class, never changing speed', () => {
        const calm = resolvePlantSwayUniformValues(calmPlantWind, part);
        assert.equal(calm.swayAmplitude, part.amplitude);
        assert.equal(calm.windStrength, 0);
        assert.equal(calm.breathAmplitude, part.breathAmplitude);
        let previous = calm.swayAmplitude;
        for (const windClass of [0.5, 1, 2, 3, 4, 9]) {
            const values = resolvePlantSwayUniformValues(
                { ...calmPlantWind, windClass },
                part,
            );
            assert.ok(values.swayAmplitude >= previous);
            assert.equal(values.swaySpeed, part.speed);
            assert.ok(values.windStrength >= 0 && values.windStrength <= 1);
            previous = values.swayAmplitude;
        }
        const storm = resolvePlantSwayUniformValues(
            { ...calmPlantWind, windClass: 4, directionDegrees: 90 },
            part,
        );
        assert.equal(storm.windStrength, 1);
        assert.ok(Math.abs(storm.windDirection[0] - 1) < 1e-9);
        assert.ok(Math.abs(storm.windDirection[1]) < 1e-9);
    });

    it('reduced motion: still in calm air, 30% sway in wind, no breathing', () => {
        const reduced = { ...calmPlantWind, reducedMotion: true };
        assert.equal(resolvePlantMotion(reduced, true), 'still');
        const still = resolvePlantSwayUniformValues(reduced, part);
        assert.equal(still.swayAmplitude, 0);
        assert.equal(still.breathAmplitude, 0);
        const windy = { ...reduced, windClass: 3 };
        assert.equal(resolvePlantMotion(windy, true), 'reduced');
        const full = resolvePlantSwayUniformValues(
            { ...windy, reducedMotion: false },
            part,
        );
        const gentle = resolvePlantSwayUniformValues(windy, part);
        assert.ok(
            Math.abs(
                gentle.swayAmplitude -
                    full.swayAmplitude * plantSwayReducedShare,
            ) < 1e-12,
        );
        assert.equal(gentle.breathAmplitude, 0);
        // The OS setting applies when no wind layer says otherwise.
        assert.equal(
            resolvePlantSwayUniformValues(calmPlantWind, {
                ...part,
                reducedMotion: true,
            }).swayAmplitude,
            0,
        );
    });

    it('writes registered uniforms in place and notifies only motion changes', () => {
        const target = { ...part, uniforms: uniforms() };
        const direction = target.uniforms.uWindDirection.value;
        const unregister = registerPlantSwayTarget(target);
        assert.equal(countPlantSwayTargets(), 1);
        assert.equal(target.uniforms.uSwayAmplitude.value, part.amplitude);
        let notified = 0;
        const unsubscribe = subscribePlantWindMotion(() => {
            notified += 1;
        });
        setPlantWind({
            windClass: 2.4,
            directionDegrees: 180,
            reducedMotion: false,
        });
        assert.equal(target.uniforms.uWindStrength.value, 0.6);
        assert.equal(target.uniforms.uWindDirection.value, direction);
        assert.ok(Math.abs((direction[1] ?? 0) - 1) < 1e-9);
        // The wind layer now decides reduced motion (it was unknown).
        assert.equal(notified, 1);
        setPlantWind({
            windClass: 2.5,
            directionDegrees: 180,
            reducedMotion: false,
        });
        assert.equal(notified, 1, 'a wind change re-renders no plant');
        setPlantWind({
            windClass: 2.5,
            directionDegrees: 180,
            reducedMotion: true,
        });
        assert.equal(notified, 2);
        setPlantWind(calmPlantWind);
        assert.equal(getPlantWind(), calmPlantWind);
        unsubscribe();
        unregister();
        assert.equal(countPlantSwayTargets(), 0);
    });
});

const view = { halfWidth: 6.4, halfHeight: 4, pixelsPerUnit: 100 };

/** A diamond island in the middle of the view, like the default garden. */
const island = createSkyObstacles(
    [
        [-3, -1.5],
        [0, -3],
        [3, -1.5],
        [0, 1.2],
    ],
    [],
);

describe('wind swooshes', () => {
    it('draws for 2.6 s and rests 0.9 s, staggered per swoosh', () => {
        const period =
            windSwooshRules.lifeSeconds + windSwooshRules.restSeconds;
        for (const index of [0, 1, 2, 3]) {
            let drawing = 0;
            const samples = 3500;
            for (let i = 0; i < samples; i += 1) {
                const { progress } = resolveSwooshCycle(
                    (i / samples) * period * 10,
                    index,
                );
                assert.ok(progress >= 0);
                if (progress < 1) drawing += 1;
            }
            const share = drawing / samples;
            assert.ok(Math.abs(share - 2.6 / 3.5) < 0.01, `share ${share}`);
        }
        assert.notEqual(
            resolveSwooshCycle(0, 0).progress,
            resolveSwooshCycle(0, 1).progress,
        );
    });

    it('is 190 px long at any zoom', () => {
        for (const zoom of [75, 100, 170]) {
            const scale = resolveSwooshScale(zoom);
            assert.ok(
                Math.abs(scale * windSwooshRules.geometryLength * zoom - 190) <
                    1e-9,
            );
        }
    });

    it('finds spots only in free sky, off clouds and each other', () => {
        const cloud: ViewRect = [3.5, 1.5, 6, 3];
        for (const flip of [1, -1] as const) {
            for (let cycle = 0; cycle < 40; cycle += 1) {
                const taken: ViewRect[] = [];
                for (let index = 0; index < 4; index += 1) {
                    const spot = findSwooshSpot({
                        cycle,
                        flip,
                        index,
                        obstacles: island,
                        placed: [cloud],
                        reducedMotion: false,
                        taken,
                        view,
                    });
                    if (!spot) continue;
                    assert.equal(
                        rectHitsPolygon(spot.rect, island.hull),
                        false,
                    );
                    assert.equal(rectsOverlap(spot.rect, cloud), false);
                    for (const other of taken) {
                        assert.equal(rectsOverlap(spot.rect, other), false);
                    }
                    assert.ok(spot.rect[1] >= -view.halfHeight);
                    assert.ok(spot.rect[3] <= view.halfHeight);
                    taken.push(spot.rect);
                }
            }
        }
    });

    it('covers its whole drift, mirrored for a left wind', () => {
        const right = resolveSwooshRect(0, 0, 1, 0.6, 0.1, 1);
        const left = resolveSwooshRect(0, 0, 1, 0.6, 0.1, -1);
        assert.deepEqual(left, [-right[2], right[1], -right[0], right[3]]);
        assert.ok(right[2] - right[0] > 1.55 + 0.6);
        const spot = findSwooshSpot({
            cycle: 3,
            flip: 1,
            index: 0,
            obstacles: emptySkyObstacles,
            placed: [],
            reducedMotion: true,
            taken: [],
            view,
        });
        assert.ok(spot);
    });

    it('starts each cycle where the clock says it does', () => {
        for (const index of [0, 1, 2, 3]) {
            for (const cycle of [0, 1, 7, 400]) {
                const start = resolveSwooshCycleStart(cycle, index);
                const at = resolveSwooshCycle(start + 1e-6, index);
                assert.equal(at.cycle, cycle);
                assert.ok(at.progress < 1e-5);
            }
        }
    });

    it('holds no lease while nothing draws, and wakes for the next swoosh with free sky', () => {
        const period =
            windSwooshRules.lifeSeconds + windSwooshRules.restSeconds;
        const spotInput = (
            obstacles: SwooshSpotInput['obstacles'],
        ): Omit<SwooshSpotInput, 'cycle' | 'index' | 'taken'> => ({
            flip: 1,
            obstacles,
            placed: [],
            reducedMotion: false,
            view,
        });
        const spotFor =
            (input: Omit<SwooshSpotInput, 'cycle' | 'index' | 'taken'>) =>
            (index: number, cycle: number, taken: readonly ViewRect[]) =>
                findSwooshSpot({ ...input, cycle, index, taken });

        // A farm that fills the view: no free sky, so nothing ever draws
        // and the layer only looks again about half a minute later.
        const filled = createSkyObstacles(
            [
                [-8, -6],
                [8, -6],
                [8, 6],
                [-8, 6],
            ],
            [],
        );
        for (let t = 0; t < 40; t += 0.25) {
            assert.deepEqual(
                resolveDrawingSwooshes(t, 4, spotFor(spotInput(filled))),
                [],
            );
        }
        const later = findNextSwooshStart({
            ...spotInput(filled),
            count: 4,
            t: 12,
        });
        assert.equal(later.found, false);
        assert.ok(later.time > 12 + (swooshLookAheadCycles - 1) * period);

        // Open sky: while a swoosh draws it holds the lease; in its rest
        // it holds none and wakes at the next cycle's start.
        const open = spotInput(emptySkyObstacles);
        const start = resolveSwooshCycleStart(5, 0);
        const during = resolveDrawingSwooshes(start + 1, 1, spotFor(open));
        assert.equal(during.length, 1);
        assert.equal(during[0]?.cycle, 5);
        assert.ok(Math.abs((during[0]?.start ?? 0) - start) < 1e-9);
        const resting = start + windSwooshRules.lifeSeconds + 0.2;
        assert.deepEqual(resolveDrawingSwooshes(resting, 1, spotFor(open)), []);
        const next = findNextSwooshStart({ ...open, count: 1, t: resting });
        assert.equal(next.found, true);
        assert.ok(Math.abs(next.time - resolveSwooshCycleStart(6, 0)) < 1e-9);
        assert.ok(Math.abs(next.time - (start + period)) < 1e-9);

        // The default island: the next start always finds a spot, so
        // swooshes keep coming; never one over the garden.
        const islandInput = spotInput(island);
        for (let t = 0; t < 60; t += 0.5) {
            for (const item of resolveDrawingSwooshes(
                t,
                4,
                spotFor(islandInput),
            )) {
                assert.equal(
                    rectHitsPolygon(item.spot.rect, island.hull),
                    false,
                );
                assert.ok(item.start <= t + 1e-9);
                assert.ok(t < item.start + windSwooshRules.lifeSeconds);
            }
            const ahead = findNextSwooshStart({ ...islandInput, count: 4, t });
            assert.equal(ahead.found, true);
            assert.ok(ahead.time > t && ahead.time <= t + period);
        }
    });

    it('blows downwind on screen', () => {
        const right = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };
        assert.equal(resolveSwooshFlip({ x: -1, z: 1 }, right), 1);
        assert.equal(resolveSwooshFlip({ x: 1, z: -1 }, right), -1);
        assert.equal(resolveSwooshFlip({ x: 1, z: 1 }, right), 1);
    });
});

describe('wind leaves', () => {
    it('take the season canopy roles and stay away in winter', () => {
        assert.equal(windLeafPalettes.winter.length, 0);
        for (const season of ['spring', 'summer', 'autumn'] as const) {
            assert.ok(windLeafPalettes[season].length >= 3);
            for (const hex of windLeafPalettes[season]) {
                assert.match(hex, /^#[0-9a-f]{6}$/);
            }
        }
    });
});
