export function reviewSessionKey(project: string) {
    return `gredice:uier:${project}`;
}

export function getReviewActivation(
    search: string,
    saved: string | null,
    exited: boolean,
) {
    const params = new URLSearchParams(search);
    if (params.get('review') === 'false') {
        return { enabled: false, explicit: true };
    }

    const explicit =
        params.get('review') === 'true' ||
        /^[A-Za-z0-9_-]{1,64}$/.test(params.get('toolbar-code') ?? '') ||
        /^[A-Za-z0-9_-]{43}$/.test(params.get('uier-token') ?? '') ||
        /^[a-f0-9-]{36}$/.test(params.get('uier-check') ?? '');

    return { enabled: explicit || (saved === '1' && !exited), explicit };
}

export function reviewToggleUrl(href: string, enabled: boolean) {
    const url = new URL(href);
    for (const key of [
        'toolbar-code',
        'uier-token',
        'uier-check',
        'uier-comment',
    ]) {
        url.searchParams.delete(key);
    }
    url.searchParams.set('review', String(enabled));
    return url.href;
}
