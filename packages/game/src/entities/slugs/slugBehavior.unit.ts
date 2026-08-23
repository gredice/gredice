import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    chooseSlugBehavior,
    getSlugAnimationTargets,
    reconcileSlugPopulation,
    slugArrivalDurationMs,
    slugCreepSpeedBlocksPerSecond,
    slugDepartureDurationMs,
} from './slugBehavior';
import type { SlugHabitatCandidate, SlugSpawn } from './slugEcology';

function candidate(
    id: string,
    x: number,
    moisture: number,
): SlugHabitatCandidate {
    return {
        blocked: false,
        id,
        moisture,
        path: false,
        score: moisture,
        shaded: true,
        suitablePlantNearby: id === 'plant',
        terrainName: 'Block_Grass',
        water: false,
        x,
        y: 0,
        z: 0,
    };
}

function spawn(value: SlugHabitatCandidate): SlugSpawn {
    return { candidate: value, id: `slug:${value.id}`, seed: value.x + 1 };
}

describe('slug behavior and lifecycle', () => {
    it('seeks a meaningfully wetter eligible cell deterministically', () => {
        const dry = candidate('dry', 0, 0.5);
        const wet = candidate('wet', 1, 0.9);
        const first = chooseSlugBehavior({
            current: dry,
            habitat: [dry, wet],
            seed: 7,
        });
        const second = chooseSlugBehavior({
            current: dry,
            habitat: [dry, wet],
            seed: 7,
        });

        assert.deepEqual(first, second);
        assert.equal(first.behavior, 'seek-damp');
        assert.equal(first.target.id, 'wet');
    });

    it('feeding is visual-only and does not mutate plant habitat input', () => {
        const plant = Object.freeze(candidate('plant', 0, 0.8));
        const before = structuredClone(plant);
        let feedingObserved = false;

        for (let seed = 0; seed < 50; seed += 1) {
            const decision = chooseSlugBehavior({
                current: plant,
                habitat: [plant],
                seed,
            });
            if (decision.behavior === 'feed') {
                assert.equal(decision.target, plant);
                feedingObserved = true;
                break;
            }
        }
        assert.equal(feedingObserved, true);
        assert.deepEqual(plant, before);
    });

    it('smoothly arrives, departs, cools down, and can later respawn', () => {
        const planned = spawn(candidate('wet', 0, 0.9));
        const initial = reconcileSlugPopulation({
            nowMs: 1_000,
            plan: [planned],
            previous: { cooldownUntilById: {}, entries: [] },
        });
        assert.equal(initial.entries[0]?.lifecycle, 'arriving');

        const active = reconcileSlugPopulation({
            nowMs: 1_000 + slugArrivalDurationMs,
            plan: [planned],
            previous: initial,
        });
        assert.equal(active.entries[0]?.lifecycle, 'active');

        const departing = reconcileSlugPopulation({
            nowMs: 3_000,
            plan: [],
            previous: active,
        });
        assert.equal(departing.entries[0]?.lifecycle, 'departing');

        const stillDeparting = reconcileSlugPopulation({
            nowMs: 3_500,
            plan: [planned],
            previous: departing,
        });
        assert.equal(stillDeparting.entries.length, 1);
        assert.equal(stillDeparting.entries[0]?.lifecycle, 'departing');

        const gone = reconcileSlugPopulation({
            nowMs: 3_000 + slugDepartureDurationMs,
            plan: [planned],
            previous: stillDeparting,
        });
        assert.equal(gone.entries.length, 0);
        assert.ok((gone.cooldownUntilById[planned.id] ?? 0) > 3_000);

        const suppressed = reconcileSlugPopulation({
            nowMs: 5_000,
            plan: [planned],
            previous: gone,
        });
        assert.equal(suppressed.entries.length, 0);

        const returned = reconcileSlugPopulation({
            nowMs: 60_000,
            plan: [planned],
            previous: suppressed,
        });
        assert.equal(returned.entries[0]?.lifecycle, 'arriving');
    });

    it('maps each behavior and lifecycle to distinct animation targets', () => {
        assert.equal(slugCreepSpeedBlocksPerSecond, 0.04);
        assert.equal(
            getSlugAnimationTargets({
                behavior: 'creep',
                lifecycle: 'active',
                lifecycleProgress: 1,
            }).bodyWave,
            1,
        );
        assert.equal(
            getSlugAnimationTargets({
                behavior: 'feed',
                lifecycle: 'active',
                lifecycleProgress: 1,
            }).feeding,
            1,
        );
        assert.equal(
            getSlugAnimationTargets({
                behavior: 'pause',
                lifecycle: 'departing',
                lifecycleProgress: 0.25,
            }).visibility,
            0.75,
        );
    });
});
