const editableRaisedBedStatuses = [
    'new',
    'approved',
    'built',
    'active',
] as const;

export type RaisedBedStatusValue = (typeof editableRaisedBedStatuses)[number];

export const RaisedBedStatusItems: Array<{
    value: RaisedBedStatusValue;
    label: string;
    icon: string;
}> = [
    { value: 'new', label: 'Nova', icon: '🆕' },
    { value: 'approved', label: 'Odobrena', icon: '✅' },
    { value: 'built', label: 'Izgrađena', icon: '🏗️' },
    { value: 'active', label: 'Aktivna', icon: '🌿' },
];

export const RaisedBedStatusDisplayItems = [
    ...RaisedBedStatusItems,
    { value: 'abandoned', label: 'Napuštena', icon: '⚠️' },
];
