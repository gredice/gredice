'use client';

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { useFormState, useFormStatus } from "react-dom";
import { bulkGenerateSlotsAction } from "./actions";

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
    const [state, formAction] = useFormState(bulkGenerateSlotsAction, null);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [selectedType, setSelectedType] = useState('');

    // Default to tomorrow and next week
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const defaultStartDate = tomorrow.toISOString().split('T')[0];
    const defaultEndDate = nextWeek.toISOString().split('T')[0]; return (
        <Card>
            <CardHeader>
                <CardTitle>Generiraj slotove u bloku</CardTitle>
            </CardHeader>
            <CardContent>
                <form action={formAction}>
                    <Stack spacing={3}>
                        <SelectItems
                            variant="outlined"
                            placeholder="Odaberi lokaciju"
                            value={selectedLocation}
                            onValueChange={setSelectedLocation}
                            items={locations.map(location => ({
                                value: location.id.toString(),
                                label: location.name
                            }))}
                        />
                        <input type="hidden" name="locationId" value={selectedLocation} />

                        <SelectItems
                            variant="outlined"
                            placeholder="Odaberi tip"
                            value={selectedType}
                            onValueChange={setSelectedType}
                            items={[
                                { value: 'delivery', label: 'Dostava' },
                                { value: 'pickup', label: 'Preuzimanje' }
                            ]}
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

                        <Input
                            type="number"
                            name="slotDurationMinutes"
                            label="Trajanje slota (minute)"
                            defaultValue="60"
                            min="30"
                            step="30"
                            required
                        />

                        <Input
                            type="number"
                            name="maxCapacity"
                            label="Maksimalni kapacitet po slotu"
                            defaultValue="5"
                            min="1"
                            required
                        />

                        <div>
                            <div className="text-sm font-medium mb-2">Dani u tjednu</div>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: '1', label: 'Pon' },
                                    { value: '2', label: 'Uto' },
                                    { value: '3', label: 'Sri' },
                                    { value: '4', label: 'Čet' },
                                    { value: '5', label: 'Pet' },
                                    { value: '6', label: 'Sub' },
                                    { value: '0', label: 'Ned' }
                                ].map(day => (
                                    <label key={day.value} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            name="daysOfWeek"
                                            value={day.value}
                                            defaultChecked={['1', '2', '3', '4', '5'].includes(day.value)} // Default to weekdays
                                        />
                                        <span className="text-sm">{day.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <SubmitButton />

                        {state?.message && (
                            <div className={`text-sm ${state.success ? 'text-green-600' : 'text-red-600'}`}>
                                {state.message}
                            </div>
                        )}
                    </Stack>
                </form>
            </CardContent>
        </Card>
    );
}
