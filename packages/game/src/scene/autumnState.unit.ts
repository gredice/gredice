import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
import { createGameState } from '../useGameState';
import { getAutumnLeafColor } from './autumnPalette';
import { autumnSeed, getAutumnState } from './autumnState';
import { getSeasonDebugDates } from './seasonDebugDates';
import { getSeasonState } from './seasonState';

test('yellowing starts on August 22 in leap and common years, before leaf fall', () => {
    for (const year of [2024, 2025, 2026]) {
        const at = (month: number, day: number, hour = 0) =>
            getAutumnState(
                getSeasonState(new Date(year, month - 1, day, hour)),
            );
        assert.equal(at(8, 21, 23).foliageColorProgress, 0);
        assert.equal(at(8, 22).foliageColorProgress, 0);
        const onset = at(8, 22, 12);
        const september = at(9, 10);
        assert.ok(onset.foliageColorProgress > 0);
        assert.ok(september.foliageColorProgress > onset.foliageColorProgress);
        assert.ok(
            at(9, 22).foliageColorProgress > september.foliageColorProgress,
        );
        for (const state of [onset, september]) {
            assert.equal(state.leafRetention, 1);
            assert.equal(state.fallingLeafIntensity, 0);
            assert.equal(state.settledLeafAmount, 0);
        }
    }
});

test('autumn curves stay normalized and continuous through every seasonal handoff', () => {
    for (const date of Object.values(getSeasonDebugDates())) {
        date.setHours(0, 0, 0, 0);
        const before = getAutumnState(
            getSeasonState(new Date(date.getTime() - 1)),
        );
        const after = getAutumnState(getSeasonState(date));
        for (const key of Object.keys(after)) {
            const a = Reflect.get(after, key);
            const b = Reflect.get(before, key);
            assert.ok(a >= 0 && a <= 1);
            assert.ok(Math.abs(a - b) < 0.001);
        }
    }
    const dates = getSeasonDebugDates();
    const summer = getAutumnState(getSeasonState(dates.summer));
    const mid = getAutumnState(getSeasonState(dates.midAutumn));
    const late = getAutumnState(getSeasonState(dates.lateAutumn));
    const winter = getAutumnState(getSeasonState(dates.winter));
    assert.equal(summer.foliageColorProgress, 0);
    assert.ok(mid.leafRetention > late.leafRetention);
    assert.ok(mid.settledLeafAmount < late.settledLeafAmount);
    assert.equal(winter.foliageColorProgress, 1);
    assert.ok(winter.leafRetention < 0.1);
    assert.ok(
        Object.values(getAutumnState(getSeasonState(new Date(NaN)))).every(
            Number.isFinite,
        ),
    );
});

test('canopy palette is deterministic, varied and never mutates the source color', () => {
    const base = new Color('#458a36');
    const original = base.clone();
    const first = getAutumnLeafColor(base, 0.5, 'tree:a');
    assert.deepEqual(first, getAutumnLeafColor(base, 0.5, 'tree:a'));
    assert.notDeepEqual(first, getAutumnLeafColor(base, 0.5, 'tree:b'));
    assert.deepEqual(base, original);
    assert.deepEqual(getAutumnLeafColor(base, 0, 'tree:a'), base);
    assert.deepEqual(getAutumnLeafColor(base, NaN, 'tree:a'), base);
    assert.equal(autumnSeed('tree:a'), autumnSeed('tree:a'));
});

test('autumn state follows scene date changes, frozen sync and reset', () => {
    const dates = getSeasonDebugDates();
    const store = createGameState({
        appBaseUrl: '',
        isMock: true,
        freezeTime: dates.summer,
    });
    assert.equal(store.getState().autumnState.foliageColorProgress, 0);
    store.getState().setFreezeTime(dates.lateAutumn);
    const frozen = store.getState().autumnState;
    store.getState().syncTimeOfDay(undefined, dates.summer);
    assert.deepEqual(store.getState().autumnState, frozen);
    store.getState().setFreezeTime(dates.winter);
    assert.equal(store.getState().autumnState.foliageColorProgress, 1);
    store.getState().clearEnvironmentOverrides();
    assert.deepEqual(
        store.getState().autumnState,
        getAutumnState(store.getState().seasonState),
    );
    store.getState().audio.dispose();
});
