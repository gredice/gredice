'use client';

import type { SelectEntity } from '@gredice/storage';
import { Edit, Megaphone } from '@signalco/ui-icons';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useState } from 'react';
import { updateEntity } from '../../../../(actions)/entityActions';

export function EntityStateSelect({ entity }: { entity: SelectEntity }) {
    const [state, setState] = useState(entity.state);

    async function handleStateChange(newState: string) {
        setState(newState);
        await updateEntity({
            id: entity.id,
            state: newState,
        });
    }

    const items = [
        {
            value: 'draft',
            label: 'U izradi',
            icon: <Edit className="size-5" />,
        },
        {
            value: 'published',
            label: 'Objavljeno',
            icon: <Megaphone className="size-5" />,
        },
    ];

    return (
        <SelectItems
            value={state}
            onValueChange={(newState) => handleStateChange(newState)}
            items={items}
        />
    );
}
