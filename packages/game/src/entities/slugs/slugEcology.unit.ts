import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createSlugSpawnPlan,
    evaluateSlugHabitatCell,
    type SlugHabitatCell,
    selectEvenlyDistributedSlugCandidates,
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
            weather: { rainy: 0.2, temperature: 19 },
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

    it('requires rain, retained wetness, or swamp moisture', () => {
        assert.equal(
            evaluateSlugHabitatCell({
                cell: { ...moistCell, shaded: false },
                recentWetness: 0,
                weather: { rainy: 0, temperature: 18 },
            }),
            null,
        );
        assert.ok(
            evaluateSlugHabitatCell({
                cell: {
                    ...moistCell,
                    shaded: false,
                    terrainName: 'Block_Swamp_Ground',
                },
                recentWetness: 0,
                weather: { rainy: 0, temperature: 18 },
            }),
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
});
