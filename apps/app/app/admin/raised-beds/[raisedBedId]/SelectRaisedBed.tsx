'use client';

import { useControllableState } from '@signalco/hooks/useControllableState';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useEffect, useState } from 'react';
import { getGardenRaisedBeds } from '../../../(actions)/gardenDataActions';

export type SelectRaisedBedProps = {
    value?: string | null;
    defaultValue?: string | null;
    onChange?: (value: string | null) => void;
    accountId: string;
    gardenId?: number;
    name?: string;
    label?: string;
    required?: boolean;
    disabled?: boolean;
};

export function SelectRaisedBed({
    value,
    defaultValue,
    onChange,
    accountId,
    gardenId,
    name,
    label,
    required,
    disabled,
}: SelectRaisedBedProps) {
    const [internalValue, setValue] = useControllableState(
        value,
        defaultValue,
        onChange,
    );
    const [raisedBeds, setRaisedBeds] = useState<
        Awaited<ReturnType<typeof getGardenRaisedBeds>>
    >([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!gardenId) {
            setRaisedBeds([]);
            return;
        }

        const fetchRaisedBeds = async () => {
            setIsLoading(true);
            try {
                const data = await getGardenRaisedBeds(gardenId, accountId);
                setRaisedBeds(data);
            } catch (error) {
                console.error('Error fetching raised beds:', error);
                setRaisedBeds([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRaisedBeds();
    }, [gardenId, accountId]);

    const items = [
        {
            value: '-',
            label: disabled ? 'Odaberite vrt prvo' : 'Odaberite gredicu...',
        },
        ...(raisedBeds?.map((raisedBed) => ({
            value: raisedBed.id.toString(),
            label: raisedBed.name || `Gredica ${raisedBed.id}`,
        })) ?? []),
    ];

    const handleOnChange = (newValue: string) => {
        setValue(newValue !== '-' ? newValue : null);
    };

    return (
        <>
            <input type="hidden" name={name} value={internalValue ?? ''} />
            <SelectItems
                items={items}
                value={internalValue ?? '-'}
                onValueChange={handleOnChange}
                label={label}
                required={required}
                disabled={disabled || isLoading || !gardenId}
            />
        </>
    );
}
