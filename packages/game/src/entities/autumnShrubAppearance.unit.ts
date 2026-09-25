import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    getAutumnCanopyShadowKey,
    getAutumnShrubCanopyStage,
} from '../scene/autumnCanopy';
import { getAutumnState } from '../scene/autumnState';
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
    assert.equal(summer.gold.getHexString(), '6d913f');
    assert.equal(summer.russet.getHexString(), '4e7f35');
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
    for (const progress of [0.1, 0.3, 0.65, 0.99]) {
        const state = appearance('spring', progress);
        assert.equal(state.gold.getHexString(), '6d913f');
        assert.equal(state.russet.getHexString(), '4e7f35');
    }
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
        assert.equal(state.gold.getHexString(), '6d913f');
        assert.equal(state.russet.getHexString(), '4e7f35');
        state.gold.set('red');
        assert.equal(
            appearance(season, 0.5, true).gold.getHexString(),
            '6d913f',
        );
    }
});

test('shrub canopy stages invalidate cached shadows and preserve the existing bush exclusion', () => {
    const stacks = [
        {
            blocks: [
                { name: 'Tree', id: 'tree', rotation: 0 },
                { name: 'AutumnShrub', id: 'shrub', rotation: 0 },
                { name: 'Bush', id: 'bush', rotation: 0 },
            ],
        },
    ];
    assert.equal(getAutumnCanopyShadowKey(stacks, 1), 'tree:full|shrub:full');
    assert.equal(
        getAutumnCanopyShadowKey(stacks, 0.45),
        'tree:thinning|shrub:thinning',
    );
    assert.equal(
        getAutumnCanopyShadowKey(stacks, 0.08),
        'tree:sparse|shrub:bare',
    );
});
