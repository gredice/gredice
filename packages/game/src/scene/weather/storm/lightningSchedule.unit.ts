import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    boltGlowMaxRadiusPx,
    lightningFlashLimits,
    relativeLuminance,
    resolveBoltFlashFootprint,
    resolveBoltGlowMaxLuminanceStep,
    resolveBoltGlowMix,
    resolveBoltGlowRadiusPx,
    resolveBoltSizing,
    resolveFlashBudgetPx,
} from './boltFlash';
import {
    boltTriangleBudget,
    countBoltTriangles,
    createBoltGeometry,
    resolveBoltSilhouetteArea,
    resolveBoltSpan,
} from './boltGeometry';
import {
    createLightningSchedule,
    createSingleLightningSchedule,
    type LightningSchedule,
    lightningMotion,
    lightningTiming,
    resolveLightningEnvelope,
    resolveLightningWindow,
    silentLightningSchedule,
} from './lightningSchedule';

/** Strike start times in [from, to), sampled every `step` seconds. */
function sampleStrikes(
    schedule: LightningSchedule,
    from: number,
    to: number,
    reducedMotion = false,
    step = 1 / 120,
) {
    const starts: number[] = [];
    let lastIndex = -1;
    for (let t = from; t < to; t += step) {
        const hit = schedule.strikeAt(t, reducedMotion);
        if (hit && hit.strike.index !== lastIndex) {
            starts.push(hit.strike.time);
            lastIndex = hit.strike.index;
        }
    }
    return starts;
}

describe('lightning schedule', () => {
    it('strikes every 7 to 11 s, never closer than 6.5 s, first at least 2 s in', () => {
        for (const seed of [1, 2, 7, 42, 1234]) {
            for (const start of [0, 3.25, 500]) {
                const schedule = createLightningSchedule({
                    seed,
                    startSeconds: start,
                });
                const first = schedule.nextStrikeAfter(start - 1);
                assert.ok(first);
                assert.ok(first.time - start >= lightningTiming.firstDelay);
                assert.ok(first.time - start <= 3.5);
                let previous = first;
                for (let i = 0; i < 200; i += 1) {
                    const next = schedule.nextStrikeAfter(previous.time);
                    assert.ok(next);
                    const gap = next.time - previous.time;
                    assert.ok(gap >= 7 && gap <= 11, `gap ${gap}`);
                    assert.ok(gap >= lightningTiming.minGap);
                    assert.equal(next.index, previous.index + 1);
                    previous = next;
                }
            }
        }
    });

    it('alternates sides and keeps the lean small', () => {
        const schedule = createLightningSchedule({ startSeconds: 0 });
        let strike = schedule.nextStrikeAfter(-1);
        for (let i = 0; i < 40 && strike; i += 1) {
            assert.equal(strike.side, i % 2);
            assert.ok(Math.abs(strike.lean) <= lightningMotion.leanJitter);
            strike = schedule.nextStrikeAfter(strike.time);
        }
    });

    it('is deterministic and answers any time in any order', () => {
        const a = createLightningSchedule({ seed: 3, startSeconds: 0 });
        const b = createLightningSchedule({ seed: 3, startSeconds: 0 });
        const times = [600, 2, 3.1, 45.7, 1200.4, 11, 0, 3600];
        for (const t of times) {
            assert.deepEqual(a.strikeAt(t, false), b.strikeAt(t, false));
            assert.deepEqual(a.nextStrikeAfter(t), b.nextStrikeAfter(t));
        }
        // Forward scanning finds the same strikes as random access.
        const fresh = createLightningSchedule({ seed: 3, startSeconds: 0 });
        const scanned = sampleStrikes(fresh, 0, 120, false, 0.05);
        let strike = b.nextStrikeAfter(-1);
        for (const time of scanned) {
            assert.equal(time, strike?.time);
            strike = strike ? b.nextStrikeAfter(strike.time) : null;
        }
    });

    it('shows each strike once, for its window only', () => {
        for (const reducedMotion of [false, true]) {
            const schedule = createLightningSchedule({ startSeconds: 0 });
            const starts = sampleStrikes(schedule, 0, 300, reducedMotion);
            assert.ok(starts.length >= 27 && starts.length <= 43);
            for (let i = 1; i < starts.length; i += 1) {
                const gap = (starts[i] ?? 0) - (starts[i - 1] ?? 0);
                assert.ok(gap >= lightningTiming.minGap);
            }
            const window = resolveLightningWindow(reducedMotion);
            const first = starts[0] ?? 0;
            assert.equal(schedule.strikeAt(first - 0.001, reducedMotion), null);
            assert.ok(schedule.strikeAt(first + window - 0.001, reducedMotion));
            assert.equal(
                schedule.strikeAt(first + window + 0.001, reducedMotion),
                null,
            );
        }
    });

    it('debug: one strike at a set time, or none', () => {
        const single = createSingleLightningSchedule(1.5);
        assert.equal(single.strikeAt(1.49, false), null);
        const hit = single.strikeAt(1.6, false);
        assert.ok(hit);
        assert.ok(Math.abs(hit.age - 0.1) < 1e-9);
        assert.equal(
            single.strikeAt(1.5 + lightningTiming.glowEnd + 0.01, false),
            null,
        );
        assert.equal(single.nextStrikeAfter(0)?.time, 1.5);
        assert.equal(single.nextStrikeAfter(2), null);
        assert.deepEqual(sampleStrikes(single, 0, 60), [1.5]);
        assert.deepEqual(sampleStrikes(silentLightningSchedule, 0, 60), []);
    });
});

describe('strike envelope', () => {
    it('grows in 90 ms, bounces once, retracts by 0.62 s', () => {
        const at = (age: number) => resolveLightningEnvelope(age, false);
        assert.equal(at(-0.01).visible, false);
        assert.ok(at(0.045).reveal > 0.4 && at(0.045).reveal < 0.6);
        assert.equal(at(lightningTiming.reveal).reveal, 1);
        assert.equal(at(0.3).retract, 0);
        assert.equal(at(lightningTiming.gone).retract, 1);
        assert.equal(at(lightningTiming.gone).visible, false);
        assert.ok(
            Math.abs(at(lightningTiming.reveal).width - 1.22) < 1e-9,
            'full 22% width at the reveal',
        );
        let widest = 0;
        let narrowest = 2;
        for (let age = 0; age <= lightningTiming.gone; age += 0.001) {
            widest = Math.max(widest, at(age).width);
            narrowest = Math.min(narrowest, at(age).width);
        }
        assert.ok(widest <= 1 + lightningMotion.widthBounce + 1e-9);
        assert.ok(narrowest > 0.85);
        assert.equal(at(0.3).opacity, 1);
    });

    it('flashes once: the bolt shows in one piece and the glow has one peak', () => {
        let showings = 0;
        let wasVisible = false;
        let peaks = 0;
        let previousGlow = 0;
        let rising = true;
        for (let age = 0; age <= 1.2; age += 0.0005) {
            const envelope = resolveLightningEnvelope(age, false);
            if (envelope.visible && !wasVisible) showings += 1;
            wasVisible = envelope.visible;
            if (rising && envelope.glow < previousGlow - 1e-12) {
                peaks += 1;
                rising = false;
            } else if (!rising && envelope.glow > previousGlow + 1e-12) {
                rising = true;
            }
            previousGlow = envelope.glow;
            assert.ok(envelope.glow <= lightningMotion.glowAmount + 1e-12);
        }
        assert.equal(showings, 1);
        assert.equal(peaks, 1);
        assert.equal(
            resolveLightningEnvelope(lightningTiming.glowEnd, false).glow,
            0,
        );
    });

    it('reduced motion: fades over 1 s ramps, holds 0.6 s, no growth, bounce or glow', () => {
        const at = (age: number) => resolveLightningEnvelope(age, true);
        assert.equal(at(0).opacity, 0);
        assert.ok(Math.abs(at(0.5).opacity - 0.5) < 1e-9);
        assert.equal(at(1).opacity, 1);
        assert.equal(at(1.6).opacity, 1);
        assert.ok(Math.abs(at(2.1).opacity - 0.5) < 1e-9);
        assert.equal(at(2.6).opacity, 0);
        let steepest = 0;
        let previous = 0;
        const step = 0.001;
        for (let age = 0; age <= 2.6; age += step) {
            const envelope = at(age);
            assert.equal(envelope.reveal, 1);
            assert.equal(envelope.retract, 0);
            assert.equal(envelope.width, 1);
            assert.equal(envelope.glow, 0);
            steepest = Math.max(
                steepest,
                Math.abs(envelope.opacity - previous) / step,
            );
            previous = envelope.opacity;
        }
        // A smoothstep over 1 s changes by at most 1.5 per second.
        assert.ok(steepest <= 1.5 + 1e-6, `steepest ${steepest}`);
    });
});

describe('bolt geometry and flash budget', () => {
    const geometry = createBoltGeometry();
    const span = resolveBoltSpan(geometry);
    const silhouetteArea = resolveBoltSilhouetteArea(geometry);

    it('is a chunky zigzag under the triangle budget, 0.46 as wide as tall', () => {
        assert.ok(countBoltTriangles(geometry) <= boltTriangleBudget);
        assert.ok(geometry.getIndex());
        const aspect = span.width / span.height;
        assert.ok(aspect > 0.43 && aspect < 0.49, `aspect ${aspect}`);
        assert.ok(Math.abs(span.minY + span.maxY) < 1e-6, 'centred');
        // The silhouette is a solid zigzag, well under its bounding box.
        const box = span.width * span.height;
        assert.ok(silhouetteArea > 0.4 * box && silhouetteArea < 0.6 * box);
    });

    it('stays inside the WCAG flash budget at every zoom and view, bolt and glow together', () => {
        const step = resolveBoltGlowMaxLuminanceStep();
        assert.ok(step > 0 && step < 1);
        // At the 40% clamp the glow does change luminance by more than 0.1
        // on the darkest cloud, so the budget has to account for it.
        assert.ok(step * lightningMotion.glowMax > 0.1);
        const geometryMeasure = { silhouetteArea, span };
        // Cloud widths in pixels: every free-sky slot and the band, with the
        // overcast gain. Bolt and glow are sized in pixels, so the zoom
        // changes nothing; the view size sets the budget.
        const cloudWidths = [215, 225, 235, 245, 250, 260, 290, 300].flatMap(
            (px) => [px, px * 1.12],
        );
        const views = [
            [1280, 800],
            [1920, 1080],
            [390, 844],
            [320, 568],
            [844, 390],
        ] as const;
        for (const zoom of [50, 75, 100, 170, 300, 500]) {
            for (const [viewWidthPx, viewHeightPx] of views) {
                for (const anchorHeightPx of [150, 96]) {
                    for (const cloudWidthPx of cloudWidths) {
                        const sizing = resolveBoltSizing({
                            anchorHeightPx,
                            cloudWidthPx,
                            geometry: geometryMeasure,
                            viewHeightPx,
                            viewWidthPx,
                        });
                        const footprint = resolveBoltFlashFootprint({
                            ...sizing,
                            geometry: geometryMeasure,
                        });
                        const label = `zoom ${zoom}, ${viewWidthPx}×${viewHeightPx}, ${anchorHeightPx} px bolt, ${cloudWidthPx} px cloud`;
                        assert.ok(
                            footprint.areaPx <= lightningFlashLimits.maxAreaPx,
                            `${label}: ${footprint.areaPx} px`,
                        );
                        assert.ok(
                            footprint.areaPx <=
                                lightningFlashLimits.maxFrameShare *
                                    viewWidthPx *
                                    viewHeightPx,
                            `${label}: ${footprint.areaPx} px of the frame`,
                        );
                        assert.ok(
                            footprint.widthPx <=
                                lightningFlashLimits.windowWidthPx,
                        );
                        assert.ok(
                            footprint.heightPx <=
                                lightningFlashLimits.windowHeightPx,
                        );
                    }
                }
            }
        }
    });

    it('keeps the full 150 px bolt and a glow of 0.3 cloud width at most on a desktop view', () => {
        for (const cloudWidthPx of [100, 225, 336]) {
            const sizing = resolveBoltSizing({
                anchorHeightPx: 150,
                cloudWidthPx,
                geometry: { silhouetteArea, span },
                viewHeightPx: 800,
                viewWidthPx: 1280,
            });
            assert.equal(sizing.boltHeightPx, 150);
            assert.ok(sizing.glowRadiusPx <= 0.3 * cloudWidthPx + 1e-9);
            assert.ok(sizing.glowRadiusPx >= Math.min(30, 0.3 * cloudWidthPx));
        }
        assert.ok(resolveFlashBudgetPx(1280, 800) <= 21_800);
    });

    it('glow: 40% at most, 0.3 of the cloud width, capped in pixels', () => {
        assert.equal(resolveBoltGlowRadiusPx(200), 60);
        assert.equal(resolveBoltGlowRadiusPx(336), boltGlowMaxRadiusPx);
        assert.equal(resolveBoltGlowMix(0.4, 0, 1), 0.4);
        assert.equal(resolveBoltGlowMix(0.9, 0, 1), lightningMotion.glowMax);
        assert.ok(resolveBoltGlowMix(0.4, 1, 1) < 0.15);
        assert.equal(resolveBoltGlowMix(0, 0, 1), 0);
        // The role colours behave as WCAG luminance expects.
        assert.ok(relativeLuminance('#fff2d0') > 0.85);
        assert.ok(relativeLuminance('#7e72d2') < 0.25);
    });
});
