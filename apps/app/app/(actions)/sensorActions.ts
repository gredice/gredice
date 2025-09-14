'use server';

import { createRaisedBedSensor, updateRaisedBedSensor } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function updateSensor(
    sensorId: number,
    sensorSignalcoId: string | null,
    status: string,
) {
    await auth(['admin']);

    await updateRaisedBedSensor({
        id: sensorId,
        sensorSignalcoId,
        status,
    });

    revalidatePath(KnownPages.Sensors);
}

export async function createSensorAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        await auth(['admin']);

        const raisedBedId = parseInt(formData.get('raisedBedId') as string, 10);
        const sensorSignalcoId = (
            formData.get('sensorSignalcoId') as string
        )?.trim().length
            ? (formData.get('sensorSignalcoId') as string).trim()
            : null;

        if (!Number.isInteger(raisedBedId)) {
            return {
                success: false,
                message: 'Molimo odaberite gredicu',
            } as const;
        }

        await createRaisedBedSensor({
            raisedBedId,
            sensorSignalcoId,
        });

        revalidatePath(KnownPages.Sensors);
        return {
            success: true,
            message: 'Senzor je uspješno kreiran',
        } as const;
    } catch (error) {
        console.error('Failed to create sensor:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri kreiranju senzora',
        } as const;
    }
}
