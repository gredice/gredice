'use client';

import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { raisedBedFieldUpdatePlant } from "../../../(actions)/raisedBedFieldsActions";

export const dynamic = 'force-dynamic';

export function RaisedBedFieldPlantStatusSelector({ raisedBedId, positionIndex, status }: {
    raisedBedId: number;
    positionIndex: number;
    status: string;
}) {
    return (
        <SelectItems
            value={status}
            onValueChange={(newValue) => {
                raisedBedFieldUpdatePlant({ raisedBedId, positionIndex, status: newValue });
            }}
            items={[
                { value: 'new', label: 'Novo' },
                { value: 'planned', label: 'Planirano' },
                { value: 'sowed', label: 'Sijano' },
                { value: 'sprouted', label: 'Proklijalo' },
                { value: 'ready', label: 'Spremno' },
                { value: 'harvesting', label: 'Berba' },
                { value: 'harvested', label: 'Ubrane' },
                { value: 'removed', label: 'Uklonjene' }
            ]}
        />
    );
}