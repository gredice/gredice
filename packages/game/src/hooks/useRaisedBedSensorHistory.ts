import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export class RaisedBedSensorHistoryRequestError extends Error {
    constructor(readonly status: number) {
        super(`Sensor history request failed (${status})`);
    }
}

export function useRaisedBedSensorHistory(
    gardenId: number,
    raisedBedId: number,
    sensorId: number | null | undefined,
    type: string,
    duration: number = 5,
) {
    return useQuery({
        queryKey: [
            'raisedBeds',
            raisedBedId,
            'sensors',
            sensorId,
            type,
            { duration },
        ],
        queryFn: async ({ signal, client, queryKey }) => {
            if (!gardenId || !raisedBedId || !sensorId || !type) {
                throw new Error(
                    'Invalid parameters for fetching sensor history',
                );
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId'].sensors[':sensorId'][':type'].$get(
                {
                    param: {
                        gardenId: gardenId.toString(),
                        raisedBedId: raisedBedId.toString(),
                        sensorId: sensorId.toString(),
                        type: type,
                    },
                    query: {
                        duration: duration?.toString(), // Duration in days, formatted as "X.00:00"
                    },
                },
                { init: { signal } },
            );
            if (response.status !== 200) {
                if (response.status === 404) {
                    signal.throwIfAborted();
                    // A later transient failure must not restore history for a missing sensor.
                    client.setQueryData(queryKey, (cached) =>
                        cached === undefined ? undefined : null,
                    );
                }
                throw new RaisedBedSensorHistoryRequestError(response.status);
            }
            const data = await response.json();
            const values = data.values.flatMap((item) => {
                if (
                    typeof item?.timeStamp !== 'string' ||
                    typeof item.valueSerialized !== 'string' ||
                    !item.valueSerialized.trim()
                ) {
                    return [];
                }
                const timestamp = Date.parse(item.timeStamp);
                const value = Number(item.valueSerialized);
                return Number.isFinite(timestamp) && Number.isFinite(value)
                    ? [{ timestamp, value }]
                    : [];
            });
            return {
                ...data,
                values,
            };
        },
        retry: false, // The API already retries transient Signalco errors.
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled:
            Boolean(gardenId) &&
            Boolean(raisedBedId) &&
            Boolean(sensorId) &&
            Boolean(type),
    });
}
