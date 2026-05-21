'use client';

import type { SelectRaisedBedSensor } from '@gredice/storage';
import { Input } from '@gredice/ui/Input';
import { Row } from '@gredice/ui/Row';
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
        <Row spacing={2}>
            <Input label="ID" value={sensor.id} readOnly />
            <Input
                label="Signalco ID"
                value={signalcoId}
                onChange={(e) => setSignalcoId(e.target.value)}
                onBlur={handleBlur}
            />
            <SelectItems
                label="Status"
                value={status}
                onValueChange={handleStatusChange}
                items={statusOptions}
            />
        </Row>
    );
}
