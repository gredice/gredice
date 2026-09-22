import type { SectionData } from './CmsSections';

export type SharedFaqEntry = {
    slug: string;
    information: { header: string; content: string };
};

/** References are authoritative, including when an entry is unpublished/missing. */
export function resolveFaqSections(
    sections: SectionData[],
    entries: SharedFaqEntry[],
) {
    const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
    return sections.map((section) => {
        if (
            section.component !== 'Faq1' ||
            typeof section.faqSlugs !== 'string' ||
            !section.faqSlugs.trim()
        )
            return section;
        const slugs = [
            ...new Set(section.faqSlugs.split(/[\s,]+/u).filter(Boolean)),
        ];
        return {
            ...section,
            features: slugs.flatMap((slug) => {
                const entry = bySlug.get(slug);
                return entry
                    ? [
                          {
                              id: entry.slug,
                              header: entry.information.header,
                              description: entry.information.content,
                          },
                      ]
                    : [];
            }),
        };
    });
}
