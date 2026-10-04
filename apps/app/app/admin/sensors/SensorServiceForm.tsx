'use client';

import type { SelectRaisedBedSensor } from '@gredice/storage';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { useState } from 'react';
import { updateSensor } from '../../(actions)/sensorActions';

const statusOptions = [
    { value: 'new', label: '🆕 Novi' },
    { value: 'installed', label: '🛠️ Instaliran' },
    { value: 'active', label: '✅ Aktivan' },
];

export function SensorServiceForm({
    sensor,
}: {
    sensor: SelectRaisedBedSensor;
}) {
    const [signalcoId, setSignalcoId] = useState(sensor.sensorSignalcoId ?? '');
    const [status, setStatus] = useState(sensor.status);

    const handleBlur = async () => {
        await updateSensor(
            sensor.id,
            signalcoId.trim().length ? signalcoId.trim() : null,
            status,
        );
    };

    const handleStatusChange = async (newStatus: string) => {
        setStatus(newStatus);
        await updateSensor(
            sensor.id,
            signalcoId.trim().length ? signalcoId.trim() : null,
            newStatus,
        );
    };

    return (
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
            <Input label="ID" value={sensor.id} readOnly fullWidth />
            <Input
                label="Signalco ID"
                value={signalcoId}
                onChange={(e) => setSignalcoId(e.target.value)}
                onBlur={handleBlur}
                fullWidth
            />
            <SelectItems
                className="min-w-0"
                label="Status"
                value={status}
                onValueChange={handleStatusChange}
                items={statusOptions}
            />
        </div>
    );
}
