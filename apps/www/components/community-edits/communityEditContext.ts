const communityEditEntityParam = 'communityEditEntity';
const communityEditFieldParam = 'communityEditField';
const communityEditSectionParam = 'communityEditSection';

export function communityEditReturnPath({
    entityKey,
    fallbackPath,
    fieldKey,
    sectionKey,
}: {
    entityKey: string;
    fallbackPath: string;
    fieldKey: string;
    sectionKey: string;
}) {
    const url =
        typeof window === 'undefined'
            ? new URL(fallbackPath, 'https://www.gredice.com')
            : new URL(window.location.href);

    url.searchParams.set(communityEditEntityParam, entityKey);
    if (fieldKey) {
        url.searchParams.set(communityEditFieldParam, fieldKey);
    } else {
        url.searchParams.delete(communityEditFieldParam);
    }
    if (sectionKey) {
        url.searchParams.set(communityEditSectionParam, sectionKey);
    } else {
        url.searchParams.delete(communityEditSectionParam);
    }

    return `${url.pathname}${url.search}${url.hash}`;
}

export function currentCommunityEditReturnRequest() {
    if (typeof window === 'undefined') {
        return null;
    }

    const url = new URL(window.location.href);
    return {
        entityKey: url.searchParams.get(communityEditEntityParam),
        fieldKey: url.searchParams.get(communityEditFieldParam) ?? '',
        sectionKey: url.searchParams.get(communityEditSectionParam) ?? '',
        clear() {
            url.searchParams.delete(communityEditEntityParam);
            url.searchParams.delete(communityEditFieldParam);
            url.searchParams.delete(communityEditSectionParam);
            window.history.replaceState(
                window.history.state,
                '',
                `${url.pathname}${url.search}${url.hash}`,
            );
        },
    };
}
