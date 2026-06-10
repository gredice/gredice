'use client';

import type { RaisedBedFieldSowingLocation } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { Check } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { setRaisedBedFieldSowingLocationAction } from '../../../(actions)/raisedBedFieldsActions';

type RaisedBedFieldLocationSelectorProps = {
    raisedBedId: number;
    positionIndex: number;
    sowingLocation: RaisedBedFieldSowingLocation;
    currentLocation: 'greenhouse' | 'raisedBed';
    greenhouseCurrentLocationEligible: boolean;
    className?: string;
};

const locationLabels = {
    greenhouse: { label: 'Staklenik', icon: '🏡' },
    raisedBed: { label: 'Gredica', icon: '🪴' },
} as const;

function getOptimisticCurrentLocation(
    sowingLocation: RaisedBedFieldSowingLocation,
    greenhouseCurrentLocationEligible: boolean,
): 'greenhouse' | 'raisedBed' {
    return sowingLocation === 'greenhouse' && greenhouseCurrentLocationEligible
        ? 'greenhouse'
        : 'raisedBed';
}

export function RaisedBedFieldLocationSelector({
    raisedBedId,
    positionIndex,
    sowingLocation,
    currentLocation,
    greenhouseCurrentLocationEligible,
    className,
}: RaisedBedFieldLocationSelectorProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [optimisticSowingLocation, setOptimisticSowingLocation] =
        useState(sowingLocation);
    const optimisticCurrentLocation =
        optimisticSowingLocation === sowingLocation
            ? currentLocation
            : getOptimisticCurrentLocation(
                  optimisticSowingLocation,
                  greenhouseCurrentLocationEligible,
              );
    const current = locationLabels[optimisticCurrentLocation];

    useEffect(() => {
        setOptimisticSowingLocation(sowingLocation);
    }, [sowingLocation]);

    const handleSelect = (nextLocation: RaisedBedFieldSowingLocation) => {
        if (nextLocation === optimisticSowingLocation) {
            return;
        }
        setOptimisticSowingLocation(nextLocation);
        startTransition(async () => {
            try {
                await setRaisedBedFieldSowingLocationAction(
                    raisedBedId,
                    positionIndex,
                    nextLocation,
                );
                router.refresh();
            } catch (error) {
                console.error('Error updating sowing location:', error);
                setOptimisticSowingLocation(sowingLocation);
                alert('Promjena lokacije sijanja nije uspjela.');
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isPending}>
                <Chip
                    size="sm"
                    variant="solid"
                    color={
                        optimisticCurrentLocation === 'greenhouse'
                            ? 'success'
                            : 'neutral'
                    }
                    startDecorator={<span aria-hidden>{current.icon}</span>}
                    title="Promijeni trenutnu lokaciju biljke"
                    className={className}
                    onClick={() => {}}
                >
                    <span className="min-w-0 truncate">{current.label}</span>
                </Chip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem
                    startDecorator={
                        <span aria-hidden className="w-4 text-center">
                            {optimisticSowingLocation === 'greenhouse' ? (
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
                            {optimisticSowingLocation === 'direct' ? (
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
