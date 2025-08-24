'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createTimeSlotAction } from './actions';

type Location = {
    id: number;
    name: string;
};

type CreateTimeSlotFormProps = {
    locations: Location[];
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Kreiranje...' : 'Kreiraj slot'}
        </Button>
    );
}

export function CreateTimeSlotForm({ locations }: CreateTimeSlotFormProps) {
    const [state, formAction] = useActionState(createTimeSlotAction, null);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [selectedType, setSelectedType] = useState('');

    // Default to tomorrow 8 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];

    return (
        <form action={formAction}>
            <Stack spacing={3}>
                <SelectItems
                    variant="outlined"
                    placeholder="Odaberi lokaciju"
                    value={selectedLocation}
                    onValueChange={setSelectedLocation}
                    items={locations.map((location) => ({
                        value: location.id.toString(),
                        label: location.name,
                    }))}
                />
                <input
                    type="hidden"
                    name="locationId"
                    value={selectedLocation}
                />

                <SelectItems
                    variant="outlined"
                    placeholder="Odaberi tip"
                    value={selectedType}
                    onValueChange={setSelectedType}
                    items={[
                        { value: 'delivery', label: 'Dostava' },
                        { value: 'pickup', label: 'Preuzimanje' },
                    ]}
                />
                <input type="hidden" name="type" value={selectedType} />

                <Input
                    type="date"
                    name="startDate"
                    label="Datum"
                    defaultValue={defaultDate}
                    required
                />

                <Input
                    type="time"
                    name="startTime"
                    label="Vrijeme početka"
                    defaultValue="08:00"
                    step="3600" // Hour increments only
                    required
                />

                <SubmitButton />

                {state?.message && (
                    <div
                        className={`text-sm ${state.success ? 'text-green-600' : 'text-red-600'}`}
                    >
                        {state.message}
                    </div>
                )}
            </Stack>
        </form>
    );
}
