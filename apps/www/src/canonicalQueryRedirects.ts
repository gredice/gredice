export function canonicalLegacyNewsQueryPath(
    pathname: string,
    searchParams: Pick<URLSearchParams, 'get'>,
): string | null {
    if (pathname !== '/') {
        return null;
    }

    const tag = searchParams.get('tag')?.trim();
    if (tag) {
        return `/novosti/sto-je-novo?tag=${encodeURIComponent(tag)}`;
    }

    const category = searchParams.get('category')?.trim();
    const type = searchParams.get('type')?.trim();
    if (type === 'changelog') {
        return '/novosti/sto-je-novo';
    }

    if (category) {
        return `/novosti?category=${encodeURIComponent(category)}`;
    }

    return type ? '/novosti' : null;
}

export function canonicalPlantArchiveQueryPath(
    pathname: string,
    searchParams: URLSearchParams,
): string | null {
    if (pathname !== '/biljke' || searchParams.get('pregled') !== 'popis') {
        return null;
    }

    const canonicalSearchParams = new URLSearchParams(searchParams);
    canonicalSearchParams.delete('pregled');
    const query = canonicalSearchParams.toString();
    return `/biljke${query ? `?${query}` : ''}`;
}
