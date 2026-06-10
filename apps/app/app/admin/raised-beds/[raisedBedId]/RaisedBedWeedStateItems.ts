import type { RaisedBedWeedStateLevel } from '@gredice/storage';

export const RaisedBedWeedStateItems: Array<{
    value: RaisedBedWeedStateLevel;
    label: string;
    icon: string;
}> = [
    { value: 'none', label: 'Bez korova', icon: 'OK' },
    { value: 'light', label: 'Lagani korov', icon: '~' },
    { value: 'heavy', label: 'Jaki korov', icon: '!' },
];

export function isRaisedBedWeedStateLevel(
    value: string,
): value is RaisedBedWeedStateLevel {
    return RaisedBedWeedStateItems.some((item) => item.value === value);
}
