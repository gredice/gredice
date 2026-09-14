import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
    GardenStructureDocumentV1,
    GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import type {
    GardenStructureCompileInput,
    GardenStructurePlanCacheDisposalReason,
    GardenStructureSemanticPlan,
} from './index';
import {
    compileGardenStructurePlan,
    GardenStructurePlanCache,
    getGardenStructureDocumentFingerprint,
    getGardenStructurePlanCacheEntryEstimatedBytes,
    getGardenStructurePlanCacheKey,
} from './index';

function cacheInput(
    document: GardenStructureDocumentV1,
    structureId = 'cache-fixture',
): GardenStructureCompileInput {
    return {
        structureId,
        revision: 4,
        document,
        placement: { anchorX: 3, anchorY: -7, rotation: 1 },
    };
}

function templateInput(
    template: GardenStructureTemplateKey,
    structureId: string,
) {
    return cacheInput(
        createGardenStructureTemplateSeed(template).document,
        structureId,
    );
}

function reorderedDocument(
    document: GardenStructureDocumentV1,
): GardenStructureDocumentV1 {
    return {
        ...document,
        footprint: { cells: [...document.footprint.cells].reverse() },
        floors: [...document.floors].reverse(),
        edges: [...document.edges].reverse(),
        roofRegions: [...document.roofRegions].reverse().map((region) => ({
            ...region,
            cells: [...region.cells].reverse(),
        })),
        props: [...document.props].reverse(),
    };
}

describe('garden structure semantic document fingerprints', () => {
    test('is stable across non-semantic array order changes', () => {
        const document = createGardenStructureTemplateSeed('house').document;
        const reordered = reorderedDocument(document);

        assert.equal(
            getGardenStructureDocumentFingerprint(document),
            getGardenStructureDocumentFingerprint(reordered),
        );
        assert.equal(
            getGardenStructurePlanCacheKey(cacheInput(document)),
            getGardenStructurePlanCacheKey(cacheInput(reordered)),
        );
    });

    test('separates local drafts that reuse persisted identity metadata', () => {
        const original = createGardenStructureTemplateSeed('house').document;
        const changed: GardenStructureDocumentV1 = {
            ...original,
            floors: original.floors.map((floor, index) =>
                index === 0 ? { ...floor, materialId: 'floor.stone' } : floor,
            ),
        };
        const originalInput = cacheInput(original);
        const changedInput = cacheInput(changed);

        assert.notEqual(
            getGardenStructureDocumentFingerprint(original),
            getGardenStructureDocumentFingerprint(changed),
        );
        assert.notEqual(
            getGardenStructurePlanCacheKey(originalInput),
            getGardenStructurePlanCacheKey(changedInput),
        );

        const cache = new GardenStructurePlanCache();
        const originalPlan = cache.getOrCompile(originalInput);
        const changedPlan = cache.getOrCompile(changedInput);
        assert.notEqual(originalPlan, changedPlan);
        assert.equal(cache.snapshot().entryCount, 2);
    });
});

describe('garden structure plan cache bounds and lifecycle', () => {
    test('returns the cached plan by reference and records hits', () => {
        const cache = new GardenStructurePlanCache();
        const input = templateInput('barn', 'hit');

        const first = cache.getOrCompile(input);
        const second = cache.getOrCompile(input);

        assert.equal(second, first);
        assert.deepEqual(
            {
                entries: cache.snapshot().entryCount,
                hits: cache.snapshot().hitCount,
                misses: cache.snapshot().missCount,
                writes: cache.snapshot().writeCount,
            },
            { entries: 1, hits: 1, misses: 1, writes: 1 },
        );
    });

    test('evicts least-recently-used plans at the entry limit', () => {
        const disposed: Array<{
            key: string;
            reason: GardenStructurePlanCacheDisposalReason;
        }> = [];
        const cache = new GardenStructurePlanCache({
            maxEntryCount: 2,
            maxEstimatedBytes: 10_000_000,
            dispose: (plan, reason) => {
                disposed.push({ key: plan.cacheKey, reason });
            },
        });
        const first = compileGardenStructurePlan(templateInput('barn', 'one'));
        const second = compileGardenStructurePlan(
            templateInput('house', 'two'),
        );
        const third = compileGardenStructurePlan(
            templateInput('greenhouse', 'three'),
        );

        cache.set(first);
        cache.set(second);
        assert.equal(cache.get(first.cacheKey), first);
        cache.set(third);

        assert.equal(cache.has(first.cacheKey), true);
        assert.equal(cache.has(second.cacheKey), false);
        assert.equal(cache.has(third.cacheKey), true);
        assert.deepEqual(disposed, [
            { key: second.cacheKey, reason: 'evicted' },
        ]);
        assert.equal(cache.snapshot().evictionCount, 1);
    });

    test('evicts by estimated byte weight independently of entry count', () => {
        const first = compileGardenStructurePlan(templateInput('barn', 'a'));
        const second = compileGardenStructurePlan(templateInput('barn', 'b'));
        const entryBytes = Math.max(
            getGardenStructurePlanCacheEntryEstimatedBytes(first),
            getGardenStructurePlanCacheEntryEstimatedBytes(second),
        );
        const cache = new GardenStructurePlanCache({
            maxEntryCount: 10,
            maxEstimatedBytes: entryBytes,
        });

        assert.equal(cache.set(first), true);
        assert.equal(cache.set(second), true);

        assert.equal(cache.has(first.cacheKey), false);
        assert.equal(cache.has(second.cacheKey), true);
        assert.equal(cache.snapshot().evictionCount, 1);
        assert.ok(cache.snapshot().estimatedBytes <= entryBytes);
    });

    test('skips an oversized plan without disposing caller-owned data', () => {
        const plan = compileGardenStructurePlan(
            templateInput('greenhouse', 'oversized'),
        );
        const disposed: GardenStructureSemanticPlan[] = [];
        const cache = new GardenStructurePlanCache({
            maxEntryCount: 2,
            maxEstimatedBytes:
                getGardenStructurePlanCacheEntryEstimatedBytes(plan) - 1,
            dispose: (disposedPlan) => {
                disposed.push(disposedPlan);
            },
        });

        assert.equal(cache.set(plan), false);
        assert.equal(cache.has(plan.cacheKey), false);
        assert.equal(cache.snapshot().oversizeSkipCount, 1);
        assert.equal(cache.snapshot().estimatedBytes, 0);
        assert.deepEqual(disposed, []);
    });

    test('clear disposes every retained plan and releases cache weight', () => {
        const disposed: Array<{
            plan: GardenStructureSemanticPlan;
            reason: GardenStructurePlanCacheDisposalReason;
        }> = [];
        const cache = new GardenStructurePlanCache({
            dispose: (plan, reason) => {
                disposed.push({ plan, reason });
            },
        });
        const first = compileGardenStructurePlan(
            templateInput('house', 'clear-one'),
        );
        const second = compileGardenStructurePlan(
            templateInput('greenhouse', 'clear-two'),
        );
        cache.set(first);
        cache.set(second);

        cache.clear();

        assert.deepEqual(
            disposed.map(({ plan, reason }) => ({
                key: plan.cacheKey,
                reason,
            })),
            [
                { key: first.cacheKey, reason: 'cleared' },
                { key: second.cacheKey, reason: 'cleared' },
            ],
        );
        assert.equal(cache.snapshot().entryCount, 0);
        assert.equal(cache.snapshot().estimatedBytes, 0);
        assert.equal(cache.snapshot().disposalCount, 2);
    });
});
