type HarvestLabelField = {
    plantStatus?: string | null;
};

type HarvestLabelScope = 'explicitField' | 'raisedBed';

export function isHarvestLabelEligible(
    field: HarvestLabelField,
    scope: HarvestLabelScope,
) {
    return scope === 'explicitField' || field.plantStatus === 'ready';
}
