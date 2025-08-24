'use client';

import { useControllableState } from '@signalco/hooks/useControllableState';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useEffect, useState } from 'react';
import { getRaisedBedFields } from '../../../(actions)/gardenDataActions';

export type SelectRaisedBedFieldProps = {
    value?: string | null;
    defaultValue?: string | null;
    onChange?: (value: string | null) => void;
    raisedBedId?: number;
    gardenId?: number;
    name?: string;
    label?: string;
    required?: boolean;
    disabled?: boolean;
};

export function SelectRaisedBedField({
    value,
    defaultValue,
    onChange,
    raisedBedId,
    gardenId,
    name,
    label,
    required,
    disabled,
}: SelectRaisedBedFieldProps) {
    const [internalValue, setValue] = useControllableState(
        value,
        defaultValue,
        onChange,
    );
    const [raisedBedFields, setRaisedBedFields] = useState<
        Awaited<ReturnType<typeof getRaisedBedFields>>
    >([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!raisedBedId || !gardenId) {
            setRaisedBedFields([]);
            return;
        }

        const fetchRaisedBedFields = async () => {
            setIsLoading(true);
            try {
                const fields = await getRaisedBedFields(raisedBedId);
                setRaisedBedFields(fields);
            } catch (error) {
                console.error('Error fetching raised bed fields:', error);
                setRaisedBedFields([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRaisedBedFields();
    }, [raisedBedId, gardenId]);

    const items = [
        {
            value: '-',
            label: disabled ? 'Odaberite gredicu prvo' : 'Odaberite polje...',
        },
        ...(raisedBedFields?.map((field) => ({
            value: field.id.toString(),
            label: `Polje ${field.positionIndex + 1}`,
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
                disabled={disabled || isLoading || !raisedBedId || !gardenId}
            />
        </>
    );
}
