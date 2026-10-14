import type { AutumnActivityState } from '@gredice/client';
import { autumnActivityMotifs } from '@gredice/js/autumnActivities';

export const autumnActivityAccountA = '00000000-0000-4000-8000-000000000010';
export const autumnActivityAccountB = '00000000-0000-4000-8000-000000000020';
export const autumnActivityWelcomeId = '00000000-0000-4000-8000-000000000101';
export const autumnActivityCompletionId =
    '00000000-0000-4000-8000-000000000102';

/** Synthetic campaign identities and evidence; never deployment configuration. */
export function createAutumnActivityFixture(): AutumnActivityState {
    function reward(
        kind: 'welcome' | 'completion',
    ): NonNullable<AutumnActivityState['campaign']>['rewards']['welcome'] {
        const modelName =
            kind === 'welcome' ? 'WoodlandAcorns' : 'AutumnWreathPost';
        const name = kind === 'welcome' ? 'Šumski žirevi' : 'Jesenski vijenac';
        return {
            snapshot: {
                contractVersion: 1,
                productId: `test-album:${kind}`,
                productVersionId: 'test:v1',
                name: { hr: name },
                description: { hr: 'Testni ukras.' },
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
                versionId: 'test-review:v1',
                modelSha256: '1'.repeat(64),
                previewSha256: '2'.repeat(64),
                previewUrl: `https://example.test/${modelName}.png`,
                spanWidth: 1,
                spanDepth: 1,
            },
        };
    }
    return {
        enabled: true,
        accountId: autumnActivityAccountA,
        campaign: {
            id: 'test-album',
            versionId: `autumn-activity:v1:${'0'.repeat(64)}`,
            name: 'Jesenski album',
            rules: [
                'Prikupi šest motiva u albumu, bilo kojim redom. Zadnji motiv automatski donosi jedan jesenski vijenac.',
                'Sudjelovanje je dobrovoljno i ne traži kupnju, radove u vrtu ili svakodnevne dolaske.',
            ],
            startsAt: '2026-10-01T00:00:00Z',
            endsAt: '2026-12-01T00:00:00Z',
            motifs: autumnActivityMotifs,
            rewards: {
                welcome: reward('welcome'),
                completion: reward('completion'),
            },
        },
        progress: {
            discoveredMotifIds: [],
            completed: false,
            welcomePurchaseId: null,
            completionPurchaseId: null,
        },
        eventStatus: 'active',
        actionAvailable: true,
        readiness: 'ready',
    };
}
