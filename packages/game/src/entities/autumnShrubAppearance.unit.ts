import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Color } from 'three';
import {
    getAutumnCanopyShadowKey,
    getAutumnShrubCanopyStage,
} from '../scene/autumnCanopy';
import { getAutumnState } from '../scene/autumnState';
import { seasonalRoles } from '../scene/seasonalRoles';
import {
    getSeasonLengthDays,
    getSeasonStartDate,
    getSeasonState,
} from '../scene/seasonState';
import { getAutumnShrubAppearance } from './autumnShrubAppearance';

function appearance(
    season: Parameters<typeof getSeasonStartDate>[0],
    progress: number,
    disabled = false,
) {
    const date = getSeasonStartDate(season, 2026);
    date.setDate(
        date.getDate() +
            progress *
                getSeasonLengthDays(season, season === 'winter' ? 2026 : 2025),
    );
    const state = getSeasonState(date);
    return getAutumnShrubAppearance({
        season: state.season,
        autumn: getAutumnState(state),
        blockId: 'shrub',
        disabled,
    });
}

test('only the new deciduous shrub loses its last leaves, using shared retention thresholds', () => {
    for (const id of ['shrub', 'different-id', 'moved-shrub']) {
        assert.equal(getAutumnShrubCanopyStage(1, id), 'full');
        assert.equal(getAutumnShrubCanopyStage(0.45, id), 'thinning');
        assert.equal(getAutumnShrubCanopyStage(0.15, id), 'sparse');
        assert.equal(getAutumnShrubCanopyStage(0.08, id), 'bare');
        assert.equal(getAutumnShrubCanopyStage(NaN, id), 'full');
    }
});

test('summer greens change to distinct gold and russet, then bare branches in winter', () => {
    const summer = appearance('summer', 0);
    const autumn = appearance('autumn', 0.35);
    assert.equal(summer.stage, 'full');
    assert.equal(summer.gold.getHexString(), '30712c');
    assert.equal(summer.russet.getHexString(), '30712c');
    assert.equal(autumn.stage, 'full');
    assert.notEqual(autumn.gold.getHexString(), summer.gold.getHexString());
    assert.notEqual(autumn.russet.getHexString(), summer.russet.getHexString());
    assert.notEqual(autumn.gold.getHexString(), autumn.russet.getHexString());
    assert.equal(appearance('autumn', 0.99).stage, 'bare');
    assert.equal(appearance('winter', 0).stage, 'bare');
    assert.equal(appearance('winter', 0.99).stage, 'bare');
});

test('spring starts bare and regrows green buds, thinning foliage and a full summer crown', () => {
    assert.equal(appearance('spring', 0).stage, 'bare');
    assert.equal(appearance('spring', 0.1).stage, 'sparse');
    assert.equal(appearance('spring', 0.3).stage, 'thinning');
    assert.equal(appearance('spring', 0.65).stage, 'full');
    const summerGreen = new Color('#30712c');
    const springGreen = new Color(seasonalRoles.springGreen.albedo);
    for (const progress of [0.1, 0.3, 0.65, 0.99]) {
        const state = appearance('spring', progress);
        // Both masses share one fresh green between the summer canopy
        // and the spring green role, never an autumn colour.
        assert.equal(state.gold.getHexString(), state.russet.getHexString());
        assert.ok(state.gold.g > state.gold.r && state.gold.g > state.gold.b);
        assert.ok(state.gold.g >= summerGreen.g - 1e-6);
        assert.ok(state.gold.g <= springGreen.g + 1e-6);
    }
    // Fresh and lighter in mid-spring, back to the summer canopy at its end.
    assert.ok(appearance('spring', 0.3).gold.g > summerGreen.g + 0.01);
    assert.equal(appearance('spring', 0.99).gold.getHexString(), '30712c');
});

test('weather disablement restores the full green crown in every season without sharing mutable colours', () => {
    for (const season of [
        'winter',
        'spring',
        'summer',
        'autumn',
    ] satisfies Parameters<typeof getSeasonStartDate>[0][]) {
        const state = appearance(season, 0.5, true);
        assert.equal(state.stage, 'full');
        assert.equal(state.gold.getHexString(), '30712c');
        assert.equal(state.russet.getHexString(), '30712c');
        state.gold.set('red');
        assert.equal(
            appearance(season, 0.5, true).gold.getHexString(),
            '30712c',
        );
    }
});

test('shrub canopy stages invalidate cached shadows and include the seasonal bush canopy', () => {
    const stacks = [
        {
            blocks: [
                { name: 'Tree', id: 'tree', rotation: 0 },
                { name: 'AutumnShrub', id: 'shrub', rotation: 0 },
                { name: 'Bush', id: 'bush', rotation: 0 },
            ],
        },
    ];
    assert.equal(
        getAutumnCanopyShadowKey(stacks, 1),
        'tree:full|shrub:full|bush:full',
    );
    assert.equal(
        getAutumnCanopyShadowKey(stacks, 0.45),
        'tree:thinning|shrub:thinning|bush:thinning',
    );
    // The round tree is bare in winter too since 2026-11-25 (was sparse: a
    // leftover crown ball on the bare branches).
    assert.equal(
        getAutumnCanopyShadowKey(stacks, 0.08),
        'tree:bare|shrub:bare|bush:sparse',
    );
});
