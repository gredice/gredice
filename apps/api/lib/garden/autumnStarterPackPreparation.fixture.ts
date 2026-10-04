import type { BlockData } from '@gredice/directory-types';
import {
    autumnArrangements,
    getAutumnArrangementItems,
} from '@gredice/js/autumnArrangements';

/** Synthetic test directory, never a production export or catalogue seed. */
export function createAutumnStarterPackTestDirectory(): BlockData[] {
    return autumnArrangements
        .flatMap((arrangement) =>
            getAutumnArrangementItems(arrangement, 'included'),
        )
        .map((item, index) => ({
            id: 900_001 + index,
            entityType: { id: 8, name: 'block', label: 'Blok' },
            slug: item.entityName,
            information: {
                shortDescription: 'Test',
                fullDescription: 'Test',
                name: item.entityName,
                label: `Probni ${item.entityName}`,
            },
            attributes: {
                type: 'decoration',
                spanWidth: ['FallenLog', 'AutumnBlanketBench'].includes(
                    item.entityName,
                )
                    ? 2
                    : 1,
                spanDepth: 1,
                stackable: false,
                placeableOnWater: false,
                nightOnlyPurchase: false,
                height: 0.4,
            },
            functions: { raisedBed: false, recycler: false },
            prices: { sunflowers: 5 + index },
            createdAt: '2026-10-02T00:00:00Z',
            updatedAt: '2026-10-02T00:00:00Z',
        }));
}
