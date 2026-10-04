const invalidViewTransitionNameCharacters = /[^a-zA-Z0-9_-]+/g;

export function getNewsArticleViewTransitionName(
    kind: 'blog' | 'changelog',
    slug: string,
) {
    const normalizedSlug =
        slug
            .replace(invalidViewTransitionNameCharacters, '-')
            .replace(/^-+|-+$/g, '') || 'article';

    return `news-${kind}-${normalizedSlug}`;
}
