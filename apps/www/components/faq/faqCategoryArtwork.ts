/** Stable directory names, independent of the category's translated heading. */
export const faqCategoryArtwork = [
    {
        name: 'harvest-and-plant-removal',
        label: 'Berba i uklanjanje biljaka',
        file: 'harvest.webp',
    },
    { name: 'usage', label: 'Korištenje gredica', file: 'using-beds.webp' },
    {
        name: 'kvaliteta-i-sigurnost-uroda',
        label: 'Kvaliteta i sigurnost uroda',
        file: 'harvest-safety.webp',
    },
    { name: 'maintenance', label: 'Održavanje', file: 'maintenance.webp' },
    { name: 'service', label: 'Usluga', file: 'service.webp' },
];

export const faqCategoryAssetPath = '/assets/faq-categories';
export const faqCategoryAssetOrigin = 'https://www.gredice.com';

export function getFaqCategoryArtwork(name: string | undefined) {
    const artwork = faqCategoryArtwork.find((item) => item.name === name);
    return artwork ? `${faqCategoryAssetPath}/${artwork.file}` : undefined;
}

export function resolveFaqCategoryImage(category: {
    information?: { name?: string };
    image?: { cover?: { url?: string } };
}) {
    const cover = category.image?.cover?.url?.trim();
    if (cover) {
        // Serve our bundled artwork locally in previews as well as production.
        const localArtwork = faqCategoryArtwork.find(
            (item) =>
                cover ===
                `${faqCategoryAssetOrigin}${faqCategoryAssetPath}/${item.file}`,
        );
        if (localArtwork) {
            return `${faqCategoryAssetPath}/${localArtwork.file}`;
        }
        if (/^https?:\/\//u.test(cover) || /^\/(?!\/)/u.test(cover)) {
            return cover;
        }
    }
    return getFaqCategoryArtwork(category.information?.name);
}
