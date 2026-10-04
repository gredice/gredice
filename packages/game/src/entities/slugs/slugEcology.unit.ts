import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createSlugSpawnPlan,
    evaluateSlugHabitatCell,
    getSlugPostRainWetness,
    quantizeSlugSurfaceWetness,
    type SlugHabitatCell,
    selectEvenlyDistributedSlugCandidates,
    slugMinimumHabitatAreaCells,
    slugPostRainSurfaceWetness,
    slugPostRainWindowMs,
    updateSlugRainHistory,
} from './slugEcology';

const moistCell = {
    blocked: false,
    id: '0:0',
    path: false,
    shaded: true,
    suitablePlantNearby: true,
    terrainName: 'Block_Grass',
    water: false,
    x: 0,
    y: 0,
    z: 0,
} satisfies SlugHabitatCell;

describe('slug ecology', () => {
    it('prefers wet shaded planted ground', () => {
        const habitat = evaluateSlugHabitatCell({
            cell: moistCell,
            recentWetness: 0.8,
            weather: { rainy: 0, temperature: 19 },
        });

        assert.ok(habitat);
        assert.equal(habitat.shaded, true);
        assert.ok(habitat.moisture >= 0.6);
    });

    it('rejects paths, water, blockers, dry terrain, snow, and hot exposure', () => {
        const rejected = [
            { ...moistCell, path: true },
            { ...moistCell, water: true },
            { ...moistCell, blocked: true },
            { ...moistCell, terrainName: 'Block_Dry_Ground' },
            { ...moistCell, terrainName: 'Block_Snow' },
            { ...moistCell, shaded: false },
        ];

        for (const [index, cell] of rejected.entries()) {
            assert.equal(
                evaluateSlugHabitatCell({
                    cell: { ...cell, id: `rejected:${index}` },
                    recentWetness: 1,
                    weather: {
                        rainy: 1,
                        snowy: index === 4 ? 1 : 0,
                        temperature: index === 5 ? 30 : 18,
                    },
                }),
                null,
            );
        }
    });

    it('requires retained post-rain wetness, including on swamp ground', () => {
        assert.equal(
            evaluateSlugHabitatCell({
                cell: { ...moistCell, shaded: false },
                recentWetness: 0,
                weather: { rainy: 0, temperature: 18 },
            }),
            null,
        );
        assert.equal(
            evaluateSlugHabitatCell({
                cell: {
                    ...moistCell,
                    shaded: false,
                    terrainName: 'Block_Swamp_Ground',
                },
                recentWetness: 0,
                weather: { rainy: 0, temperature: 18 },
            }),
            null,
        );
        assert.equal(
            evaluateSlugHabitatCell({
                cell: moistCell,
                recentWetness: 1,
                weather: { rainy: 1, temperature: 18 },
            }),
            null,
        );
        assert.ok(
            evaluateSlugHabitatCell({
                cell: moistCell,
                recentWetness: 0.8,
                weather: { rainy: 0, temperature: 18 },
            }),
        );
    });

    it('quantizes surface wetness so rain blending does not rebuild every frame', () => {
        assert.equal(quantizeSlugSurfaceWetness(0.74), 0.7);
        assert.equal(quantizeSlugSurfaceWetness(0.76), 0.8);
        assert.equal(quantizeSlugSurfaceWetness(0.08), 0);
        assert.equal(quantizeSlugSurfaceWetness(0.09), 0.1);
        assert.equal(quantizeSlugSurfaceWetness(0.19), 0.1);
        assert.equal(quantizeSlugSurfaceWetness(0.2), 0.2);
        assert.equal(quantizeSlugSurfaceWetness(2), 1);
    });

    it('opens a bounded spawn window only after observed rain ends', () => {
        const initial = {
            lastRainEndedAtMs: null,
            qualifyingRainObserved: false,
            rainActive: false,
        };
        const raining = updateSlugRainHistory({
            nowMs: 1_000,
            previous: initial,
            rainIntensity: 0.8,
        });
        const easingOut = updateSlugRainHistory({
            nowMs: 4_000,
            previous: raining,
            rainIntensity: 0.1,
        });
        const ended = updateSlugRainHistory({
            nowMs: 5_000,
            previous: easingOut,
            rainIntensity: 0,
        });

        assert.equal(
            getSlugPostRainWetness({
                history: raining,
                nowMs: 4_000,
                rainIntensity: 0.8,
            }),
            0,
        );
        assert.equal(easingOut.rainActive, true);
        assert.equal(easingOut.lastRainEndedAtMs, null);
        assert.equal(
            getSlugPostRainWetness({
                history: easingOut,
                nowMs: 4_500,
                rainIntensity: 0.1,
            }),
            0,
        );
        assert.equal(
            getSlugPostRainWetness({
                history: ended,
                nowMs: 5_001,
                rainIntensity: 0,
            }),
            slugPostRainSurfaceWetness,
        );
        assert.equal(
            getSlugPostRainWetness({
                history: ended,
                nowMs: 5_000 + slugPostRainWindowMs + 1,
                rainIntensity: 0,
            }),
            0,
        );
    });

    it('does not open a post-rain window for unqualified drizzle', () => {
        const initial = {
            lastRainEndedAtMs: null,
            qualifyingRainObserved: false,
            rainActive: false,
        };
        const drizzle = updateSlugRainHistory({
            nowMs: 1_000,
            previous: initial,
            rainIntensity: 0.1,
        });
        const ended = updateSlugRainHistory({
            nowMs: 2_000,
            previous: drizzle,
            rainIntensity: 0,
        });

        assert.equal(drizzle.rainActive, true);
        assert.equal(drizzle.qualifyingRainObserved, false);
        assert.equal(ended.lastRainEndedAtMs, null);
        assert.equal(
            getSlugPostRainWetness({
                history: ended,
                nowMs: 2_001,
                rainIntensity: 0,
            }),
            0,
        );
    });

    it('closes an existing window as soon as another rain event begins', () => {
        const ended = {
            lastRainEndedAtMs: 2_000,
            qualifyingRainObserved: false,
            rainActive: false,
        };
        const rainingAgain = updateSlugRainHistory({
            nowMs: 3_000,
            previous: ended,
            rainIntensity: 0.8,
        });

        assert.equal(rainingAgain.lastRainEndedAtMs, null);
        assert.equal(rainingAgain.rainActive, true);
        assert.equal(
            getSlugPostRainWetness({
                history: rainingAgain,
                nowMs: 3_001,
                rainIntensity: 0.8,
            }),
            0,
        );
    });

    it('requires a connected minimum habitat area before planning a spawn', () => {
        const candidates = Array.from(
            { length: slugMinimumHabitatAreaCells },
            (_, index) => ({
                ...moistCell,
                id: `${index}:0`,
                moisture: 0.8,
                score: 0.8,
                x: index,
            }),
        );

        assert.deepEqual(
            createSlugSpawnPlan({
                candidates: candidates.slice(0, -1),
                seed: 'small-patch',
            }),
            [],
        );
        assert.equal(
            createSlugSpawnPlan({ candidates, seed: 'large-patch' }).length,
            1,
        );
    });

    it('is deterministic under a supplied seed and enforces both caps', () => {
        const candidates = Array.from({ length: 12 }, (_, index) => ({
            ...moistCell,
            id: `${index}:0`,
            moisture: 0.8,
            score: 0.8,
            x: index,
        }));
        const first = createSlugSpawnPlan({
            candidates,
            localCap: 1,
            localRadius: 2,
            maxPopulation: 4,
            seed: 'garden:17',
        });
        const second = createSlugSpawnPlan({
            candidates,
            localCap: 1,
            localRadius: 2,
            maxPopulation: 4,
            seed: 'garden:17',
        });
        const anotherSeed = createSlugSpawnPlan({
            candidates,
            localCap: 1,
            localRadius: 2,
            maxPopulation: 4,
            seed: 'garden:18',
        });

        assert.deepEqual(first, second);
        assert.notDeepEqual(first, anotherSeed);
        assert.equal(first.length, 4);
        for (const spawn of first) {
            assert.equal(
                first.filter(
                    (other) =>
                        Math.hypot(
                            spawn.candidate.x - other.candidate.x,
                            spawn.candidate.z - other.candidate.z,
                        ) <= 2,
                ).length,
                1,
            );
        }
    });

    it('bounds habitat evaluation without biasing one garden edge', () => {
        const cells = Array.from({ length: 270 }, (_, index) => index);
        const sampled = selectEvenlyDistributedSlugCandidates(cells, 96);

        assert.equal(sampled.length, 96);
        assert.equal(sampled[0], 0);
        assert.ok((sampled[47] ?? 0) > 120);
        assert.ok((sampled.at(-1) ?? 0) > 260);
    });

    it('does not exceed the cap around an already selected central slug', () => {
        const candidates = [
            { ...moistCell, id: 'center', moisture: 1, score: 1, x: 0 },
            { ...moistCell, id: 'left', moisture: 0.8, score: 0.8, x: -3 },
            { ...moistCell, id: 'right', moisture: 0.8, score: 0.8, x: 3 },
        ];
        const plan = createSlugSpawnPlan({
            candidates,
            localCap: 2,
            localRadius: 3,
            maxPopulation: 3,
            minimumHabitatAreaCells: 1,
            seed: 'central-cap',
        });

        assert.equal(plan.length, 2);
        for (const spawn of plan) {
            assert.ok(
                plan.filter(
                    (other) =>
                        Math.hypot(
                            spawn.candidate.x - other.candidate.x,
                            spawn.candidate.z - other.candidate.z,
                        ) <= 3,
                ).length <= 2,
            );
        }
    });
});
