export const STATUS_OPTIONS = [
    'all',
    'pending',
    'conflicted',
    'approved',
    'applied',
    'rejected',
    'canceled',
] as const;

const STATUS_OPTION_VALUES: readonly string[] = STATUS_OPTIONS;

export const ENTITY_TYPE_OPTIONS = [
    'all',
    'plant',
    'plantSort',
    'operation',
    'block',
] as const;

export const AGE_OPTIONS = ['all', 'day', 'week', 'older'] as const;

const AGE_OPTION_VALUES: readonly string[] = AGE_OPTIONS;

export type StatusOption = (typeof STATUS_OPTIONS)[number];
export type AgeOption = (typeof AGE_OPTIONS)[number];

export function statusLabel(status: StatusOption | string) {
    switch (status) {
        case 'all':
            return 'Svi';
        case 'pending':
            return 'Na čekanju';
        case 'approved':
            return 'Odobreno';
        case 'applied':
            return 'Primijenjeno';
        case 'rejected':
            return 'Odbijeno';
        case 'conflicted':
            return 'Konflikt';
        case 'canceled':
            return 'Otkazano';
        default:
            return status;
    }
}

export function entityTypeLabel(entityTypeName: string) {
    switch (entityTypeName) {
        case 'plant':
            return 'Biljka';
        case 'plantSort':
            return 'Sorta';
        case 'operation':
            return 'Radnja';
        case 'block':
            return 'Blok';
        default:
            return entityTypeName;
    }
}

export function isStatusOption(
    value: string | undefined,
): value is StatusOption {
    return typeof value === 'string' && STATUS_OPTION_VALUES.includes(value);
}

export function isAgeOption(value: string | undefined): value is AgeOption {
    return typeof value === 'string' && AGE_OPTION_VALUES.includes(value);
}

export function ageLabel(age: AgeOption) {
    switch (age) {
        case 'all':
            return 'Sva dob';
        case 'day':
            return 'Zadnja 24 h';
        case 'week':
            return '2-7 dana';
        case 'older':
            return 'Starije';
    }
}
