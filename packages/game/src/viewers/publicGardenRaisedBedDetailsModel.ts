import type { PublicGardenDetail } from './PublicGardenViewer';

export type PublicGardenRaisedBed = PublicGardenDetail['raisedBeds'][number];
export type PublicGardenRaisedBedField =
    PublicGardenRaisedBed['fields'][number];

export type PublicGardenPlantMilestone = {
    label: string;
    value: string;
};

const publicGardenPlantDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
});

export function getPublicGardenActivePlantFields<
    TField extends {
        active?: boolean | null;
        plantSortId?: number | null;
        positionIndex: number;
    },
>(raisedBed: { fields: TField[] }) {
    return raisedBed.fields
        .filter(
            (field) => field.active && typeof field.plantSortId === 'number',
        )
        .sort((left, right) => left.positionIndex - right.positionIndex);
}

function formatPublicGardenPlantDate(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return publicGardenPlantDateFormatter.format(date);
}

export function getPublicGardenPlantMilestones(
    field: Pick<
        PublicGardenRaisedBedField,
        | 'plantGrowthDate'
        | 'plantHarvestedDate'
        | 'plantReadyDate'
        | 'plantScheduledDate'
        | 'plantSowDate'
    >,
): PublicGardenPlantMilestone[] {
    const milestones: Array<{
        label: string;
        value: Date | string | null | undefined;
    }> = [
        ...(!field.plantSowDate
            ? [
                  {
                      label: 'Planirano',
                      value: field.plantScheduledDate,
                  },
              ]
            : []),
        { label: 'Posijano', value: field.plantSowDate },
        { label: 'Proklijalo', value: field.plantGrowthDate },
        { label: 'Spremno za berbu', value: field.plantReadyDate },
        { label: 'Ubrano', value: field.plantHarvestedDate },
    ];

    return milestones.flatMap((milestone) => {
        const value = formatPublicGardenPlantDate(milestone.value);
        return value ? [{ label: milestone.label, value }] : [];
    });
}

export function getPublicGardenPlantStatusColor(
    status: string | null | undefined,
): 'error' | 'info' | 'neutral' | 'success' | 'warning' {
    switch (status) {
        case 'notSprouted':
        case 'died':
            return 'error';
        case 'ready':
            return 'info';
        case 'sprouted':
        case 'firstFlowers':
        case 'firstFruitSet':
            return 'success';
        case 'new':
        case 'planned':
        case 'sowed':
        case 'pendingVerification':
            return 'warning';
        default:
            return 'neutral';
    }
}

export function getPublicGardenPlantLocationLabel(
    field: Pick<PublicGardenRaisedBedField, 'plantStatus' | 'sowingLocation'>,
) {
    if (field.sowingLocation === 'direct') {
        return 'Izravna sjetva';
    }

    if (field.sowingLocation !== 'greenhouse') {
        return null;
    }

    if (
        ['new', 'planned', 'pendingVerification', 'sowed', 'sprouted'].includes(
            field.plantStatus ?? '',
        )
    ) {
        return 'U plasteniku';
    }

    return 'Presadnica iz plastenika';
}

export function getPublicGardenPlantCountLabel(count: number) {
    const modulo100 = count % 100;
    const modulo10 = count % 10;
    const noun =
        modulo10 === 1 && modulo100 !== 11
            ? 'biljka'
            : modulo10 >= 2 &&
                modulo10 <= 4 &&
                (modulo100 < 12 || modulo100 > 14)
              ? 'biljke'
              : 'biljaka';

    return `${count.toString()} ${noun}`;
}
