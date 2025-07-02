import { useQuery } from "@tanstack/react-query";
import { client } from "@gredice/client";

export function useRaisedBedSensorHistory(gardenId: number, raisedBedId: number, sensorId: number | null | undefined, type: string, duration: number = 5) {
    return useQuery({
        queryKey: ['raisedBeds', raisedBedId, 'sensors', sensorId, type, { duration }],
        queryFn: async () => {
            if (!gardenId || !raisedBedId || !sensorId || !type) {
                console.error('Invalid parameters for fetching sensor history');
                return null;
            }

            const response = await client().api.gardens[":gardenId"]["raised-beds"][":raisedBedId"].sensors[":sensorId"][":type"].$get({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                    sensorId: sensorId.toString(),
                    type: type
                },
                query: {
                    duration: duration?.toString() // Duration in days, formatted as "X.00:00"
                }
            });
            if (response.status === 400) {
                console.error('Failed to fetch sensor data - bad request', response);
                return null;
            }
            if (response.status === 404) {
                console.error('Raised bed not found or no sensors available', response);
                return null;
            }
            const data = await response.json();
            return {
                ...data,
                values: data.values.map((item: any) => ({
                    ...item,
                    timeStamp: new Date(item.timeStamp),
                })),
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: Boolean(gardenId) && Boolean(raisedBedId) && Boolean(sensorId) && Boolean(type),
    });
}