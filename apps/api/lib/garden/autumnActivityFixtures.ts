import type { BlockData } from '@gredice/directory-types';
import { autumnActivityMotifs } from '@gredice/js/autumnActivities';
import { defineAutumnActivityCampaign } from './autumnActivityCampaign';

/** Synthetic identities only; no real campaign or directory configuration. */
export function autumnActivityFixtureCampaign(name = 'Testni jesenski album') {
    function reward(kind: 'welcome' | 'completion') {
        const modelName =
            kind === 'welcome' ? 'WoodlandAcorns' : 'AutumnWreathPost';
        return {
            snapshot: {
                contractVersion: 1,
                productId: `autumn-reward:test-album:${kind}`,
                productVersionId: 'fixture',
                name: { hr: modelName },
                description: { hr: 'Testni ukras bez novčane vrijednosti.' },
                previews: [`https://example.test/${modelName}.png`],
                currency: 'sunflower',
                chargedSunflowers: 0,
                publication: 'published',
                availableFrom: null,
                availableUntil: null,
                policy: {
                    versionId: 'zero-cosmetic:v1',
                    refunds: 'unused-units-paid-value',
                    recycling: 'configured-per-unit-value',
                    seasonExpiry: 'retain-owned-units',
                    gardenDeletion: 'recycle-placed-units-once',
                    accountDeletion: 'detach-owner-retain-audit',
                },
                lines: [
                    {
                        lineId: kind,
                        entityId: kind === 'welcome' ? '901' : '902',
                        modelName,
                        variant: null,
                        quantity: 1,
                        paidSunflowersByUnit: [0],
                        recyclingSunflowersByUnit: [0],
                    },
                ],
            },
            review: {
                versionId: 'synthetic-review:v1',
                modelSha256: '1'.repeat(64),
                previewSha256: '2'.repeat(64),
                previewUrl: `https://example.test/${modelName}.png`,
                spanWidth: 1,
                spanDepth: 1,
            },
        };
    }
    return defineAutumnActivityCampaign({
        id: 'test-album',
        versionId: `autumn-activity:v1:${'0'.repeat(64)}`,
        name,
        rules: [
            'Prikupi šest motiva u albumu. Zadnji motiv daje jedan vijenac. Nema kupnje, nizova dolazaka ni dokazivanja pronalaska u vrtu. Ukrasi ostaju tvoji i nakon događaja.',
        ],
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-12-01T00:00:00Z',
        motifs: autumnActivityMotifs,
        rewards: {
            welcome: reward('welcome'),
            completion: reward('completion'),
        },
    });
}
export function autumnActivityFixtureBlocks(): BlockData[] {
    return [
        { id: 1, name: 'Block_Grass', terrain: true },
        { id: 901, name: 'WoodlandAcorns', terrain: false },
        { id: 902, name: 'AutumnWreathPost', terrain: false },
    ].map(({ id, name, terrain }) => ({
        id,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: name,
        information: {
            name,
            label: name,
            shortDescription: name,
            fullDescription: name,
        },
        attributes: {
            type: terrain ? 'terrain' : 'decoration',
            height: terrain ? 0.1 : 1,
            spanWidth: 1,
            spanDepth: 1,
            stackable: terrain,
            nightOnlyPurchase: false,
        },
        functions: { raisedBed: false, recycler: false },
        prices: { sunflowers: 9999 },
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
    }));
}
