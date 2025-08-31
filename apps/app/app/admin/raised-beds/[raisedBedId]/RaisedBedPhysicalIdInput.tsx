'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { type ChangeEvent, useState } from 'react';
import { setRaisedBedPhysicalId } from '../../../(actions)/raisedBedActions';

interface RaisedBedPhysicalIdInputProps {
    raisedBedId: number;
    physicalId: string | null;
}

export function RaisedBedPhysicalIdInput({
    raisedBedId,
    physicalId,
}: RaisedBedPhysicalIdInputProps) {
    const [value, setValue] = useState(physicalId ?? '');

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const handleBlur = async () => {
        await setRaisedBedPhysicalId(
            raisedBedId,
            value.trim().length ? value.trim() : null,
        );
    };

    return (
        <Input
            label="Fizička oznaka"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
        />
    );
}
