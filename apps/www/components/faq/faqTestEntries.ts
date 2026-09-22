import type { FaqData } from '@gredice/client';

/** Local fixtures for component stories/tests; no live directory dependency. */
export const faqTestEntries: FaqData[] = ['Prvo pitanje', 'Drugo pitanje'].map(
    (header, index) => ({
        id: index + 1,
        slug: `pitanje-${index + 1}`,
        entityType: { id: 2, name: 'faq', label: 'FAQ' },
        information: {
            name: `pitanje-${index + 1}`,
            header,
            content: 'Kratak odgovor s [poveznicom na dostavu](/dostava).',
        },
        attributes: {
            category: {
                id: 1,
                information: {
                    name: 'service',
                    label: 'Kako Gredice funkcioniraju',
                },
            },
        },
        createdAt: '2026-09-22T00:00:00Z',
        updatedAt: '2026-09-22T00:00:00Z',
    }),
);
