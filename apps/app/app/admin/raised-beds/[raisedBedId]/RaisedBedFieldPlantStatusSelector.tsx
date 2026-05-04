'use client';

import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { raisedBedFieldUpdatePlant } from '../../../(actions)/raisedBedFieldsActions';

export const dynamic = 'force-dynamic';

export function RaisedBedFieldPlantStatusSelector({
    raisedBedId,
    positionIndex,
    status,
}: {
    raisedBedId: number;
    positionIndex: number;
    status: string;
}) {
    return (
        <SelectItems
            value={status}
            onValueChange={(newValue) => {
                raisedBedFieldUpdatePlant({
                    raisedBedId,
                    positionIndex,
                    status: newValue,
                });
            }}
            items={[
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
            ]}
        />
    );
}
