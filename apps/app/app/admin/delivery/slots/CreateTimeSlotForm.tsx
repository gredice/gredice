'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { useActionState, useEffect, useState } from 'react';
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

function formatDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function CreateTimeSlotForm({ locations }: CreateTimeSlotFormProps) {
    const [state, formAction] = useActionState(createTimeSlotAction, null);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [timeZone, setTimeZone] = useState('Europe/Zagreb');

    // Default to tomorrow 8 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = formatDateInputValue(tomorrow);

    useEffect(() => {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }, []);

    return (
        <form action={formAction}>
            <Stack spacing={6}>
                <input type="hidden" name="timeZone" value={timeZone} />

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

                <Input
                    type="datetime-local"
                    name="closesAt"
                    label="Zatvara se"
                    helperText="Prazno koristi zadano automatsko zatvaranje"
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
