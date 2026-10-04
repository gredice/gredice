import type { PlantData } from '@gredice/directory-types';

export type CalendarActivity = keyof PlantData['calendar'];

export const calendarActivityKeys: CalendarActivity[] = [
    'propagating',
    'sowing',
    'planting',
    'harvest',
];

export const calendarActivities = {
    propagating: {
        name: 'Sjetva u zaštićenom prostoru',
        shortName: 'Sijanje unutra',
        color: 'bg-blue-400',
    },
    sowing: {
        name: 'Izravna sjetva',
        shortName: 'Sijanje vani',
        color: 'bg-yellow-400',
    },
    planting: {
        name: 'Presađivanje',
        shortName: 'Presađivanje',
        color: 'bg-amber-600',
    },
    harvest: { name: 'Berba', shortName: 'Berba', color: 'bg-lime-400' },
} satisfies Record<
    CalendarActivity,
    { name: string; shortName: string; color: string }
>;

export const calendarMonthNames = [
    'Siječanj',
    'Veljača',
    'Ožujak',
    'Travanj',
    'Svibanj',
    'Lipanj',
    'Srpanj',
    'Kolovoz',
    'Rujan',
    'Listopad',
    'Studeni',
    'Prosinac',
];
