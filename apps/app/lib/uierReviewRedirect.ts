export function adminReviewRedirectUrl(
    searchParams: Record<string, string | string[] | undefined>,
): `/admin${'' | `?${string}`}` {
    const query = new URLSearchParams();
    for (const key of [
        'review',
        'toolbar-code',
        'uier-token',
        'uier-check',
        'uier-comment',
    ]) {
        const value = searchParams[key];
        if (typeof value === 'string') query.set(key, value);
    }

    const serialized = query.toString();
    return serialized ? `/admin?${serialized}` : '/admin';
}
