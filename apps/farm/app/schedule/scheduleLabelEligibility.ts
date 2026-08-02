type HarvestLabelField = {
    plantStatus?: string | null;
};

export function isHarvestLabelEligible(field: HarvestLabelField) {
    return field.plantStatus === 'ready';
}
