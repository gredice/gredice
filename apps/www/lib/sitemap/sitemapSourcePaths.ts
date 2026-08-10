const sourceCmsPagePaths = ['/biljni-susjedi', '/kvaliteta-i-sigurnost-uroda'];
const staticNewsPaths = ['/novosti', '/novosti/sto-je-novo'];

type CmsSitemapPage = {
    slug: string;
    state: string;
    publishedAt: Date | string | null;
    noIndex: boolean;
};

type PublicGardenSitemapSource = {
    id: number;
};

type SluggedSitemapSource = {
    slug?: string | null;
};

export function collectSitemapSourcePaths({
    cmsPages,
    publicGardens,
    seeds,
    brands,
}: {
    cmsPages: ReadonlyArray<CmsSitemapPage>;
    publicGardens: ReadonlyArray<PublicGardenSitemapSource>;
    seeds: ReadonlyArray<SluggedSitemapSource>;
    brands: ReadonlyArray<SluggedSitemapSource>;
}) {
    const paths = new Set([...sourceCmsPagePaths, ...staticNewsPaths]);

    for (const page of cmsPages) {
        if (page.state === 'published' && page.publishedAt && !page.noIndex) {
            paths.add(`/${page.slug}`);
        }
    }

    paths.add('/vrtovi');
    for (const garden of publicGardens) {
        paths.add(`/vrtovi/${garden.id}`);
    }

    paths.add('/sjeme');
    paths.add('/sjeme/brendovi');
    for (const seed of seeds) {
        if (seed.slug) {
            paths.add(`/sjeme/${seed.slug}`);
        }
    }
    for (const brand of brands) {
        if (brand.slug) {
            paths.add(`/sjeme/brend/${brand.slug}`);
        }
    }

    return Array.from(paths);
}
