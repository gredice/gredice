import type { FaqData } from '@gredice/client';

export function groupFaqCategories(entries: FaqData[]) {
    const sections = new Map<
        string,
        { category: FaqData['attributes']['category']; entries: FaqData[] }
    >();
    for (const entry of entries) {
        const category = entry.attributes?.category ?? {
            id: 0,
            information: { name: 'uncategorized', label: 'Ostala pitanja' },
        };
        const key = category.information.name;
        const section = sections.get(key);
        if (section) {
            section.entries.push(entry);
        } else {
            sections.set(key, { category, entries: [entry] });
        }
    }
    return [...sections.values()].sort((a, b) =>
        a.category.information.label.localeCompare(
            b.category.information.label,
            'hr',
        ),
    );
}
