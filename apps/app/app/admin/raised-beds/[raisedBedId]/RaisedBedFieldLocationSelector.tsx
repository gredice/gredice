'use client';

import type { RaisedBedFieldSowingLocation } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Check } from '@gredice/ui/icons';
import { useTransition } from 'react';
import { setRaisedBedFieldSowingLocationAction } from '../../../(actions)/raisedBedFieldsActions';

type RaisedBedFieldLocationSelectorProps = {
    raisedBedId: number;
    positionIndex: number;
    sowingLocation: RaisedBedFieldSowingLocation;
    currentLocation: 'greenhouse' | 'raisedBed';
};

const locationLabels = {
    greenhouse: { label: 'Staklenik', icon: '🏡' },
    raisedBed: { label: 'Gredica', icon: '🪴' },
} as const;

export function RaisedBedFieldLocationSelector({
    raisedBedId,
    positionIndex,
    sowingLocation,
    currentLocation,
}: RaisedBedFieldLocationSelectorProps) {
    const [isPending, startTransition] = useTransition();
    const current = locationLabels[currentLocation];

    const handleSelect = (nextLocation: RaisedBedFieldSowingLocation) => {
        if (nextLocation === sowingLocation) {
            return;
        }
        startTransition(async () => {
            await setRaisedBedFieldSowingLocationAction(
                raisedBedId,
                positionIndex,
                nextLocation,
            );
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isPending}>
                <Chip
                    size="sm"
                    variant="solid"
                    color={
                        currentLocation === 'greenhouse' ? 'success' : 'neutral'
                    }
                    startDecorator={<span aria-hidden>{current.icon}</span>}
                    title="Promijeni trenutnu lokaciju biljke"
                    onClick={() => {}}
                >
                    {current.label}
                </Chip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem
                    startDecorator={
                        <span aria-hidden className="w-4 text-center">
                            {sowingLocation === 'greenhouse' ? (
                                <Check className="size-4" />
                            ) : null}
                        </span>
                    }
                    onSelect={() => handleSelect('greenhouse')}
                >
                    <span aria-hidden className="mr-1">
                        {locationLabels.greenhouse.icon}
                    </span>
                    {locationLabels.greenhouse.label}
                </DropdownMenuItem>
                <DropdownMenuItem
                    startDecorator={
                        <span aria-hidden className="w-4 text-center">
                            {sowingLocation === 'direct' ? (
                                <Check className="size-4" />
                            ) : null}
                        </span>
                    }
                    onSelect={() => handleSelect('direct')}
                >
                    <span aria-hidden className="mr-1">
                        {locationLabels.raisedBed.icon}
                    </span>
                    {locationLabels.raisedBed.label}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
