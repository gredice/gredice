'use server';

import { updateRaisedBedSensor } from '@gredice/storage';
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
