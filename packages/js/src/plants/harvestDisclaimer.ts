const HARVEST_DISCLAIMER_TEXT = {
    autoRemove: 'Nakon ove berbe biljka se uklanja u istoj radnji.',
    autoRemoveWithExample:
        'Nakon ove berbe biljka se uklanja u istoj radnji (npr. mrkva).',
    requiresSeparateRemoval:
        'Nakon ove berbe biljka ostaje u polju pa je uklanjanje biljke zasebna radnja.',
    requiresSeparateRemovalWithExample:
        'Nakon ove berbe biljka ostaje u polju, pa je uklanjanje biljke zasebna radnja (npr. rajčica).',
    behaviorOverview:
        'Kod berbe neke biljke ostaju u polju i uklanjaju se zasebnom radnjom, dok se neke uklanjaju odmah nakon berbe.',
};

export function getHarvestOperationRemovalDisclaimer(
    removePlant: boolean | undefined,
    includeExamples = false,
) {
    if (removePlant) {
        return includeExamples
            ? HARVEST_DISCLAIMER_TEXT.autoRemoveWithExample
            : HARVEST_DISCLAIMER_TEXT.autoRemove;
    }

    return includeExamples
        ? HARVEST_DISCLAIMER_TEXT.requiresSeparateRemovalWithExample
        : HARVEST_DISCLAIMER_TEXT.requiresSeparateRemoval;
}

export function getHarvestPlantRemovalDisclaimer(
    cleanHarvest: boolean | undefined,
) {
    return cleanHarvest
        ? 'Nakon berbe biljka se automatski uklanja iz polja.'
        : 'Nakon berbe biljka može ostati u polju i tada je uklanjanje zasebna radnja.';
}

export function getHarvestBehaviorOverviewDisclaimer() {
    return HARVEST_DISCLAIMER_TEXT.behaviorOverview;
}
