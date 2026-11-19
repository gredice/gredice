import {
    type CommunityEditRequestStatus,
    type CommunityEntitySuggestionValue,
    communityEditableSectionLabel,
    getCommunityEditableFieldDefinition,
    parseCommunityEntitySuggestionRequest,
} from '@gredice/storage';

/*
 * Public wording for a community edit request: the title, context and field
 * labels a submitter or a profile visitor reads. Nothing here exposes the
 * internal reviewer note, the reviewer's identity or the submitter's e-mail.
 */

const requestStatuses: readonly CommunityEditRequestStatus[] = [
    'applied',
    'approved',
    'canceled',
    'conflicted',
    'pending',
    'rejected',
];

const missingEntityTitle = 'Zapis';
const maxListedSuggestionPlants = 3;

const suggestionKindLabels = {
    plantSort: 'Nova sorta',
    plantTip: 'Novi savjet',
    operation: 'Nova radnja',
    disease: 'Nova bolest',
    pest: 'Novi štetnik',
} satisfies Record<CommunityEntitySuggestionValue['kind'], string>;

/** Section keys that entity suggestions are stored under. */
const suggestionSectionLabels = new Map([
    ['new-plant-sort', suggestionKindLabels.plantSort],
    ['new-plant-tip', suggestionKindLabels.plantTip],
    ['new-operation', suggestionKindLabels.operation],
    ['new-disease', suggestionKindLabels.disease],
    ['new-pest', suggestionKindLabels.pest],
]);

type PresentableRequest = {
    entityTypeName: string;
    entityId: number;
    sectionKey: string | null;
    submitterNote: string | null;
    changes: readonly { fieldKey: string; sectionKey: string | null }[];
};

export function communityEditRequestStatus(
    status: string,
): CommunityEditRequestStatus {
    return (
        requestStatuses.find((knownStatus) => knownStatus === status) ??
        'pending'
    );
}

/** Label for a section key, including the keys entity suggestions use. */
export function communityEditSectionContext(
    sectionKey: string | null,
    entityTypeName: string,
) {
    if (!sectionKey) {
        return null;
    }

    return (
        suggestionSectionLabels.get(sectionKey) ??
        communityEditableSectionLabel(sectionKey, entityTypeName)
    );
}

function suggestionSubject(suggestion: CommunityEntitySuggestionValue) {
    switch (suggestion.kind) {
        case 'plantSort':
        case 'plantTip':
            return suggestion.parentPlantName;
        case 'operation':
            return suggestion.stageLabel;
        case 'disease':
        case 'pest': {
            const names = suggestion.affectedPlants
                .slice(0, maxListedSuggestionPlants)
                .map((plant) => plant.name);
            const remaining = suggestion.affectedPlants.length - names.length;
            return remaining > 0
                ? `${names.join(', ')} i još ${remaining}`
                : names.join(', ');
        }
    }
}

function suggestionContext(suggestion: CommunityEntitySuggestionValue) {
    const subject = suggestionSubject(suggestion);
    const kindLabel = suggestionKindLabels[suggestion.kind];
    return subject ? `${kindLabel} · ${subject}` : kindLabel;
}

/**
 * The one section an edit belongs to: the request's own section, or the
 * section all of its changes share. A page-level edit across sections has
 * none.
 */
function editSectionKey(request: PresentableRequest) {
    if (request.sectionKey) {
        return request.sectionKey;
    }

    const changeSectionKeys = new Set(
        request.changes.map((change) => change.sectionKey),
    );
    if (changeSectionKeys.size !== 1) {
        return null;
    }

    const [sectionKey] = changeSectionKeys;
    return sectionKey ?? null;
}

function editChangeLabels(request: PresentableRequest) {
    const labels = new Set<string>();
    for (const change of request.changes) {
        // Fields that left the registry have no public label; skip them
        // rather than leak an internal field key.
        const label = getCommunityEditableFieldDefinition(
            request.entityTypeName,
            change.fieldKey,
        )?.publicLabel;
        if (label) {
            labels.add(label);
        }
    }
    return [...labels];
}

type CommunityEditRequestPresentation = {
    kind: 'edit' | 'suggestion';
    /** Entity public name; for a suggestion, the suggested name. */
    title: string;
    /** Edits: the section label. Suggestions: kind and subject. */
    context: string | null;
    /** Public labels of the changed fields; empty for suggestions. */
    changeLabels: string[];
};

export function presentCommunityEditRequest(
    request: PresentableRequest,
    entityLabels: ReadonlyMap<number, string>,
): CommunityEditRequestPresentation {
    const suggestion = parseCommunityEntitySuggestionRequest(request);
    if (suggestion) {
        return {
            kind: 'suggestion',
            title: suggestion.name,
            context: suggestionContext(suggestion),
            changeLabels: [],
        };
    }

    return {
        kind: 'edit',
        title: entityLabels.get(request.entityId) ?? missingEntityTitle,
        context: communityEditSectionContext(
            editSectionKey(request),
            request.entityTypeName,
        ),
        changeLabels: editChangeLabels(request),
    };
}

/** A page a user helped improve, as listed on their public profile. */
export function presentCommunityContributionPage(
    page: {
        entityTypeName: string;
        entityId: number;
        publicPath: string;
        sectionKey: string | null;
        appliedAt: Date;
    },
    entityLabels: ReadonlyMap<number, string>,
) {
    return {
        title: entityLabels.get(page.entityId) ?? missingEntityTitle,
        context: communityEditSectionContext(
            page.sectionKey,
            page.entityTypeName,
        ),
        publicPath: page.publicPath,
        appliedAt: page.appliedAt.toISOString(),
    };
}
