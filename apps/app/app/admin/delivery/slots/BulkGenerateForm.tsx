'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { bulkGenerateSlotsAction } from './actions';

type Location = {
    id: number;
    name: string;
};

type BulkGenerateFormProps = {
    locations: Location[];
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Generirajanje...' : 'Generiraj slotove'}
        </Button>
    );
}

export function BulkGenerateForm({ locations }: BulkGenerateFormProps) {
    const [state, formAction] = useActionState(bulkGenerateSlotsAction, null);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [selectedType, setSelectedType] = useState('');

    // Default to tomorrow and next week
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const defaultStartDate = tomorrow.toISOString().split('T')[0];
    const defaultEndDate = nextWeek.toISOString().split('T')[0];

    // Reset form on successful submission
    useEffect(() => {
        if (state?.success) {
            const timer = setTimeout(() => {
                setSelectedLocation('');
                setSelectedType('');
            }, 2000); // Reset after showing success message
            return () => clearTimeout(timer);
        }
    }, [state?.success]);

    const handleSubmit = (formData: FormData) => {
        // Validate required fields
        if (!selectedLocation) {
            alert('Molimo odaberite lokaciju');
            return;
        }
        if (!selectedType) {
            alert('Molimo odaberite tip slota');
            return;
        }

        // Check if at least one day is selected
        const daysOfWeek = formData.getAll('daysOfWeek');
        if (daysOfWeek.length === 0) {
            alert('Molimo odaberite barem jedan dan u tjednu');
            return;
        }

        // Validate time range
        const startTime = formData.get('startTime') as string;
        const endTime = formData.get('endTime') as string;
        const startDate = formData.get('startDate') as string;
        const endDate = formData.get('endDate') as string;

        if (startTime >= endTime) {
            alert('Vrijeme završetka mora biti nakon vremena početka');
            return;
        }

        if (new Date(endDate) < new Date(startDate)) {
            alert('Datum završetka mora biti nakon datuma početka');
            return;
        }

        formAction(formData);
    };

    return (
        <form action={handleSubmit}>
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
                    required
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
                    required
                />
                <input type="hidden" name="type" value={selectedType} />

                <Input
                    type="date"
                    name="startDate"
                    label="Datum početka"
                    defaultValue={defaultStartDate}
                    required
                />

                <Input
                    type="date"
                    name="endDate"
                    label="Datum završetka"
                    defaultValue={defaultEndDate}
                    required
                />

                <Input
                    type="time"
                    name="startTime"
                    label="Vrijeme početka"
                    defaultValue="08:00"
                    step="3600"
                    required
                />

                <Input
                    type="time"
                    name="endTime"
                    label="Vrijeme završetka"
                    defaultValue="18:00"
                    step="3600"
                    required
                />

                <div>
                    <div className="text-sm font-medium mb-2">
                        Dani u tjednu
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { value: '1', label: 'Pon' },
                            { value: '2', label: 'Uto' },
                            { value: '3', label: 'Sri' },
                            { value: '4', label: 'Čet' },
                            { value: '5', label: 'Pet' },
                            { value: '6', label: 'Sub' },
                            { value: '0', label: 'Ned' },
                        ].map((day) => (
                            <label
                                key={day.value}
                                className="flex items-center space-x-2"
                            >
                                <input
                                    type="checkbox"
                                    name="daysOfWeek"
                                    value={day.value}
                                    defaultChecked={[
                                        '1',
                                        '2',
                                        '3',
                                        '4',
                                        '5',
                                    ].includes(day.value)} // Default to weekdays
                                />
                                <span className="text-sm">{day.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

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
