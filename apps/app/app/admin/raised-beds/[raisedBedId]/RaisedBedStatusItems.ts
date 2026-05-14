const raisedBedStatuses = ['new', 'approved', 'built', 'active'] as const;

export type RaisedBedStatusValue = (typeof raisedBedStatuses)[number];

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
