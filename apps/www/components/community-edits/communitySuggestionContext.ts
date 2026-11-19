import type {
    CommunityEntitySuggestionButtonProps,
    CommunityEntitySuggestionKind,
} from './CommunityEntitySuggestionButton.types';

const communitySuggestionParam = 'communitySuggestion';

/** Wording of a suggestion kind: the dashed trigger card and the dialog. */
export function suggestionLabels(kind: CommunityEntitySuggestionKind) {
    switch (kind) {
        case 'plantTip':
            return {
                cardTitle: 'Imaš savjet?',
                cardHelper: 'Predloži novi savjet za ovu biljku.',
                title: 'Predloži novi savjet',
                name: 'Naslov savjeta',
                description: 'Tvoj savjet',
            };
        case 'plantSort':
            return {
                cardTitle: 'Nedostaje sorta?',
                cardHelper: 'Predloži novu sortu za naš popis.',
                title: 'Predloži novu sortu',
                name: 'Naziv sorte',
                description: 'Po čemu je sorta posebna?',
            };
        case 'operation':
            return {
                cardTitle: 'Nedostaje radnja?',
                cardHelper: 'Predloži novu radnju za naš popis.',
                title: 'Predloži novu radnju',
                name: 'Naziv radnje',
                description: 'Što se radnjom radi?',
            };
        case 'disease':
            return {
                cardTitle: 'Nedostaje bolest?',
                cardHelper: 'Predloži bolest ili je poveži s biljkom.',
                title: 'Predloži bolest',
                name: 'Naziv bolesti',
                description: 'Kratki opis bolesti',
            };
        case 'pest':
            return {
                cardTitle: 'Nedostaje štetnik?',
                cardHelper: 'Predloži štetnika ili ga poveži s biljkom.',
                title: 'Predloži štetnika',
                name: 'Naziv štetnika',
                description: 'Kratki opis štetnika',
            };
    }
}

/** Identifies one suggestion trigger so a sign-in return reopens the right one. */
export function suggestionContextKey(
    props: CommunityEntitySuggestionButtonProps,
) {
    if (props.kind === 'plantSort' || props.kind === 'plantTip') {
        return `${props.kind}:${props.parentPlantId.toString()}`;
    }

    if (props.kind === 'operation') {
        return props.defaultStageId
            ? `${props.kind}:${props.defaultStageId.toString()}`
            : props.kind;
    }

    return props.defaultAffectedPlantId
        ? `${props.kind}:${props.defaultAffectedPlantId.toString()}`
        : props.kind;
}

export function suggestionReturnPath(contextKey: string, fallbackPath: string) {
    const url =
        typeof window === 'undefined'
            ? new URL(fallbackPath, 'https://www.gredice.com')
            : new URL(window.location.href);
    url.searchParams.set(communitySuggestionParam, contextKey);
    return `${url.pathname}${url.search}${url.hash}`;
}

/** True once when the page was opened by a sign-in return for this trigger. */
export function consumeSuggestionReturn(contextKey: string) {
    if (typeof window === 'undefined') {
        return false;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get(communitySuggestionParam) !== contextKey) {
        return false;
    }
    url.searchParams.delete(communitySuggestionParam);
    window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
    );
    return true;
}
