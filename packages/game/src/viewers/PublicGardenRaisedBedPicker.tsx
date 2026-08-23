'use client';

import { RaisedBedSimpleIcon } from '@gredice/ui/RaisedBedSimpleIcon';
import { useId } from 'react';
import type { PublicGardenRaisedBed } from './publicGardenRaisedBedDetailsModel';

export function PublicGardenRaisedBedPicker({
    onSelect,
    raisedBeds,
}: {
    onSelect: (raisedBedId: number) => void;
    raisedBeds: PublicGardenRaisedBed[];
}) {
    const selectId = useId();

    if (raisedBeds.length === 0) {
        return null;
    }

    return (
        <div className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-black/10 bg-background/90 py-1 pr-1 pl-3 shadow-lg backdrop-blur-md">
            <RaisedBedSimpleIcon
                aria-hidden
                className="size-5 shrink-0 text-primary"
            />
            <label className="sr-only" htmlFor={selectId}>
                Odaberi gredicu za pregled
            </label>
            <select
                className="h-8 min-w-0 max-w-52 cursor-pointer rounded-full border-0 bg-transparent pr-2 text-sm font-medium text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                data-public-garden-raised-bed-picker
                defaultValue=""
                id={selectId}
                onChange={(event) => {
                    const raisedBedId = Number.parseInt(
                        event.currentTarget.value,
                        10,
                    );
                    if (Number.isFinite(raisedBedId)) {
                        onSelect(raisedBedId);
                    }
                    event.currentTarget.value = '';
                }}
            >
                <option disabled value="">
                    Pregledaj gredicu
                </option>
                {raisedBeds.map((raisedBed) => (
                    <option key={raisedBed.id} value={raisedBed.id}>
                        {raisedBed.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
