export const RAISED_BED_STATUS_ABANDONED = 'abandoned';
export const RAISED_BED_ABANDON_OPERATION_ENTITY_ID = 591;
export const RAISED_BED_OPERATION_ENTITY_TYPE_NAME = 'operation';

export const RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE =
    'Gredica je napuštena zbog neaktivnosti.';
export const RAISED_BED_ABANDONED_MESSAGE = 'Gredica je napuštena.';
export const RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE =
    'Nove sjetve i radnje više nisu dostupne za ovu gredicu.';

export function isRaisedBedAbandoned(status?: string | null) {
    return status === RAISED_BED_STATUS_ABANDONED;
}
