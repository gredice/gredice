const MARKDOWN_LINK_DESTINATION_PATTERN = /\]\([^)]*\)/g;

const RAW_OPERATION_URL_PATTERN =
    /\b(?:https?:\/\/)?(?:www\.)?gredice\.com\/radnje\/[^\s)\]]+/gi;

const INTERNAL_TERM_REPLACEMENTS = new Map([
    ['allowedTargetStatuses', 'moguća stanja'],
    ['availableOperations', 'dostupne radnje'],
    ['currentFieldWeedLevel', 'razina korova'],
    ['currentFieldWeedState', 'stanje korova'],
    ['currentLocation', 'trenutačna lokacija'],
    ['daysFromDead', 'dani od propadanja'],
    ['daysFromGrowth', 'dani od nicanja'],
    ['daysFromHarvest', 'dani od berbe'],
    ['daysFromReady', 'dani od spremnosti za berbu'],
    ['daysFromSowing', 'dani od sjetve'],
    ['isAnalyzedField', 'označeno polje'],
    ['isFocusField', 'označeno polje'],
    ['isGreenhouseSeedling', 'presadnica'],
    ['needsRemoval', 'oznaka za uklanjanje'],
    ['operationUrlFieldIndex', 'oznaka polja za poveznicu'],
    ['pastPlantFields', 'ranije biljke'],
    ['plantFieldOperationUrlTemplate', 'poveznica za radnju na polju'],
    ['plantName', 'naziv biljke'],
    ['plantSortId', 'biljka'],
    ['plantStatus', 'stanje biljke'],
    ['positionIndex', 'polje'],
    ['positionLabel', 'polje'],
    ['raisedBedOperationUrl', 'poveznica za radnju na gredici'],
    ['requestedStatus', 'predloženo stanje'],
    ['requestedWeedLevel', 'predložena razina korova'],
    ['sowingLocation', 'mjesto sjetve'],
    ['toBeRemoved', 'oznaka za uklanjanje'],
    ['weedProposals', 'prijedlozi za korov'],
]);

function protectMarkdownLinkDestinations(value: string) {
    const protectedSegments: string[] = [];
    const text = value.replace(MARKDOWN_LINK_DESTINATION_PATTERN, (segment) => {
        const token = `__GREDICE_AI_MARKDOWN_DESTINATION_${protectedSegments.length}__`;
        protectedSegments.push(segment);

        return token;
    });

    return {
        text,
        restore: (nextValue: string) =>
            protectedSegments.reduce(
                (restored, segment, index) =>
                    restored.replace(
                        `__GREDICE_AI_MARKDOWN_DESTINATION_${index}__`,
                        segment,
                    ),
                nextValue,
            ),
    };
}

function fieldLabelFromPositionIndex(value: string) {
    const positionIndex = Number.parseInt(value, 10);

    return Number.isFinite(positionIndex) && positionIndex >= 0
        ? `polje ${positionIndex + 1}`
        : 'polje';
}

function fieldLabelFromPositionLabel(value: string) {
    const positionLabel = Number.parseInt(value, 10);

    return Number.isFinite(positionLabel) && positionLabel > 0
        ? `polje ${positionLabel}`
        : 'polje';
}

function replaceInternalTerms(value: string) {
    let nextValue = value;

    for (const [term, replacement] of INTERNAL_TERM_REPLACEMENTS) {
        nextValue = nextValue.replace(
            new RegExp(`\`?\\b${term}\\b\`?`, 'gi'),
            replacement,
        );
    }

    return nextValue;
}

export function sanitizeRaisedBedAiMarkdown(markdown: string) {
    const protectedMarkdown = protectMarkdownLinkDestinations(markdown);
    let sanitized = protectedMarkdown.text
        .replace(RAW_OPERATION_URL_PATTERN, 'poveznica za radnju')
        .replace(
            /\b(polje\s+\d+)\s*,\s*`?\bpositionIndex\b`?\s*[:=]?\s*-?\d+\b`?/gi,
            '$1',
        )
        .replace(
            /`?\bpositionIndex\b`?\s*[:=]?\s*(-?\d+)\b`?/gi,
            (_match, value: string) => fieldLabelFromPositionIndex(value),
        )
        .replace(
            /`?\bpositionLabel\b`?\s*[:=]?\s*(\d+)\b`?/gi,
            (_match, value: string) => fieldLabelFromPositionLabel(value),
        )
        .replace(
            /`?\b(?:needsRemoval|toBeRemoved)\b`?\s*[:=]?\s*true\b`?/gi,
            'označeno za uklanjanje',
        )
        .replace(
            /`?\b(?:needsRemoval|toBeRemoved)\b`?\s*[:=]?\s*false\b`?/gi,
            'nije označeno za uklanjanje',
        )
        .replace(
            /`?\bcurrentLocation\b`?\s*[:=]?\s*["'`]?greenhouse["'`]?/gi,
            'trenutačno u stakleniku',
        )
        .replace(
            /`?\bcurrentLocation\b`?\s*[:=]?\s*["'`]?raisedBed["'`]?/gi,
            'trenutačno u gredici',
        )
        .replace(
            /`?\bsowingLocation\b`?\s*[:=]?\s*["'`]?greenhouse["'`]?/gi,
            'sijano u stakleniku',
        )
        .replace(
            /`?\bsowingLocation\b`?\s*[:=]?\s*["'`]?direct["'`]?/gi,
            'direktno sijano',
        );

    sanitized = replaceInternalTerms(sanitized)
        .replace(/\bpolje\s+(\d+)\s*,\s*polje\s+\1\b/gi, 'polje $1')
        .replace(/`true`/gi, 'da')
        .replace(/`false`/gi, 'ne');

    return protectedMarkdown.restore(sanitized);
}
