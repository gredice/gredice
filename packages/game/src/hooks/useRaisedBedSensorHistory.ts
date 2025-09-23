import { client } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

interface SensorHistoryApiValue extends Record<string, unknown> {
    timeStamp: string;
    valueSerialized?: string;
}

interface SensorHistoryApiResponse extends Record<string, unknown> {
    values: SensorHistoryApiValue[];
}

interface SensorHistoryValue extends SensorHistoryApiValue {
    timeStamp: Date;
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
        queryFn: async () => {
            if (!gardenId || !raisedBedId || !sensorId || !type) {
                console.error('Invalid parameters for fetching sensor history');
                return null;
            }

            const response = await client().api.gardens[':gardenId'][
                'raised-beds'
            ][':raisedBedId'].sensors[':sensorId'][':type'].$get({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                    sensorId: sensorId.toString(),
                    type: type,
                },
                query: {
                    duration: duration?.toString(), // Duration in days, formatted as "X.00:00"
                },
            });
            if (response.status === 400) {
                console.error(
                    'Failed to fetch sensor data - bad request',
                    response,
                );
                return null;
            }
            if (response.status === 404) {
                console.error(
                    'Raised bed not found or no sensors available',
                    response,
                );
                return null;
            }
            const data = (await response.json()) as SensorHistoryApiResponse;
            const values: SensorHistoryValue[] = data.values.map((item) => ({
                ...item,
                timeStamp: new Date(item.timeStamp),
            }));
            return {
                ...data,
                values,
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled:
            Boolean(gardenId) &&
            Boolean(raisedBedId) &&
            Boolean(sensorId) &&
            Boolean(type),
    });
}
