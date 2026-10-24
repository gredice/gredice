import { getFaqData } from '../../lib/plants/getFaqData';
import { FaqSectionView } from './FaqSectionView';
import { faqPlacements } from './faqPlacements';

export async function RelatedFaq({
    placement,
}: {
    placement: keyof typeof faqPlacements;
}) {
    const { title, slugs } = faqPlacements[placement];
    const entries = await getFaqData();
    const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
    return (
        <FaqSectionView
            title={title}
            entries={slugs.flatMap((slug) => {
                const entry = bySlug.get(slug);
                return entry ? [entry] : [];
            })}
        />
    );
}
