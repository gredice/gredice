'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Modal } from '@gredice/ui/Modal';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createSensorAction } from '../../(actions)/sensorActions';

type RaisedBed = {
    id: number;
    physicalId: string | null;
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Kreiranje...' : 'Kreiraj senzor'}
        </Button>
    );
}

export function CreateSensorModal({ raisedBeds }: { raisedBeds: RaisedBed[] }) {
    const [selectedRaisedBed, setSelectedRaisedBed] = useState('');
    const [state, formAction] = useActionState(createSensorAction, null);

    return (
        <Modal
            title={'Novi senzor'}
            trigger={<Button variant="outlined">Dodaj</Button>}
        >
            <form action={formAction}>
                <Stack spacing={4}>
                    <SelectItems
                        variant="outlined"
                        placeholder="Odaberi gredicu"
                        value={selectedRaisedBed}
                        onValueChange={setSelectedRaisedBed}
                        items={raisedBeds.map((bed) => ({
                            value: bed.id.toString(),
                            label: bed.physicalId
                                ? `Gr ${bed.physicalId}`
                                : `RB ${bed.id}`,
                        }))}
                    />
                    <input
                        type="hidden"
                        name="raisedBedId"
                        value={selectedRaisedBed}
                    />
                    <Input label="Signalco ID" name="sensorSignalcoId" />
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
        </Modal>
    );
}
