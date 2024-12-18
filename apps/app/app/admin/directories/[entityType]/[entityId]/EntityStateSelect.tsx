'use client';

import { SelectEntity } from "@gredice/storage";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { updateEntity } from "../../../../(actions)/entityActions";
import { useState } from "react";

export function EntityStateSelect({ entity }: { entity: SelectEntity }) {
    const [state, setState] = useState(entity.state);

    async function handleStateChange(newState: string) {
        setState(newState);
        await updateEntity({
            id: entity.id,
            state: newState
        });
    }

    const items = [
        { value: 'draft', label: 'U izradi' },
        { value: 'published', label: 'Objavljeno' },
    ];

    return (
        <SelectItems
            value={state}
            onValueChange={(newState) => handleStateChange(newState)}
            items={items} />
    )
}