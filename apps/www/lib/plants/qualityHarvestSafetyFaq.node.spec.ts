import assert from 'node:assert/strict';
import test from 'node:test';
import type { FaqData } from '@gredice/client';
import {
    mergeQualityHarvestSafetyFaqEntries,
    qualityHarvestSafetyFaqEntries,
} from './qualityHarvestSafetyFaq.ts';

const bannedPublicClaimPhrases = [
    'HACCP certificirani',
    'HACCP certifikat',
    'u potpunosti HACCP compliant',
    'ready-to-eat',
    'oprano i spremno za jelo',
];

test('quality harvest safety FAQ entries are category-backed and link to the public page', () => {
    assert.equal(qualityHarvestSafetyFaqEntries.length, 6);

    for (const entry of qualityHarvestSafetyFaqEntries) {
        assert.equal(
            entry.attributes.category.information.label,
            'Kvaliteta i sigurnost uroda',
        );
        assert.match(
            entry.information.content,
            /kvaliteta-i-sigurnost-uroda|urod/iu,
        );
    }
});

test('quality harvest safety FAQ fallback does not duplicate live directory entries', () => {
    const liveEntry = {
        ...qualityHarvestSafetyFaqEntries[0],
        id: 4501,
    } satisfies FaqData;

    const merged = mergeQualityHarvestSafetyFaqEntries([liveEntry]);
    assert.equal(
        merged.filter((entry) => entry.slug === liveEntry.slug).length,
        1,
    );
    assert.equal(merged.length, qualityHarvestSafetyFaqEntries.length);
});

test('quality harvest safety FAQ avoids risky public claim phrases', () => {
    const serialized = JSON.stringify(qualityHarvestSafetyFaqEntries);

    for (const phrase of bannedPublicClaimPhrases) {
        assert.equal(
            serialized.includes(phrase),
            false,
            `FAQ content must not include "${phrase}"`,
        );
    }
});
