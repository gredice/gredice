import type { RaisedBedFieldPlantHistoryEntry } from '../../utils/raisedBedFields';

/** Status confirms a milestone even when its date is absent in an older record. */
export function plantLifecycleMilestones(
    field: RaisedBedFieldPlantHistoryEntry,
) {
    const status = field.plantStatus ?? '';
    const harvested =
        Boolean(field.plantHarvestedDate) || status === 'harvested';
    const ready =
        Boolean(field.plantReadyDate) || status === 'ready' || harvested;
    const sprouted =
        Boolean(field.plantGrowthDate) ||
        ready ||
        ['sprouted', 'firstFlowers', 'firstFruitSet'].includes(status);
    const sowed =
        Boolean(field.plantSowDate) ||
        sprouted ||
        ['pendingVerification', 'sowed', 'notSprouted', 'died'].includes(
            status,
        );
    return { sowed, sprouted, ready, harvested };
}
