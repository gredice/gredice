'use client';

import { SelectItems } from '@gredice/ui/SelectItems';
import { raisedBedFieldUpdatePlant } from '../../../(actions)/raisedBedFieldsActions';

export const dynamic = 'force-dynamic';

export const raisedBedFieldPlantStatusItems = [
    { value: 'new', label: 'Novo', icon: '🆕' },
    { value: 'planned', label: 'Planirano', icon: '🗓️' },
    {
        value: 'pendingVerification',
        label: 'Čeka verifikaciju',
        icon: '🔍',
    },
    { value: 'sowed', label: 'Sijano', icon: '🫘' },
    { value: 'sprouted', label: 'Proklijalo', icon: '🌱' },
    { value: 'firstFlowers', label: 'Prvi cvjetovi', icon: '🌸' },
    { value: 'firstFruitSet', label: 'Prvi plodovi', icon: '🍅' },
    { value: 'notSprouted', label: 'Nije proklijalo', icon: '❌' },
    { value: 'died', label: 'Uginulo', icon: '💀' },
    { value: 'ready', label: 'Spremno', icon: '🥕' },
    { value: 'harvested', label: 'Ubrane', icon: '🌾' },
    { value: 'removed', label: 'Uklonjene', icon: '🗑️' },
];

export function RaisedBedFieldPlantStatusSelector({
    raisedBedId,
    positionIndex,
    status,
    variant = 'outlined',
    className,
}: {
    raisedBedId: number;
    positionIndex: number;
    status: string;
    variant?: 'outlined' | 'plain';
    className?: string;
}) {
    return (
        <SelectItems
            value={status}
            variant={variant}
            className={className}
            onValueChange={(newValue) => {
                raisedBedFieldUpdatePlant({
                    raisedBedId,
                    positionIndex,
                    status: newValue,
                });
            }}
            items={raisedBedFieldPlantStatusItems}
        />
    );
}
