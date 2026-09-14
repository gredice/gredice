import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { DiaryList } from './RaisedBedDiary';

export function SelectedPlantingDiary({
    gardenId,
    raisedBedId,
    plantingId,
}: {
    gardenId: number;
    raisedBedId: number;
    plantingId: number;
}) {
    const { data, error, isLoading } = useQuery({
        queryKey: ['raisedBeds', raisedBedId, 'plantings', plantingId, 'diary'],
        queryFn: async () => {
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ]['raised-beds'][':raisedBedId'].plantings[':plantingId'][
                'diary-entries'
            ].$get({
                param: {
                    gardenId: String(gardenId),
                    raisedBedId: String(raisedBedId),
                    plantingId: String(plantingId),
                },
            });
            if (response.status !== 200)
                throw new Error('Učitavanje dnevnika nije uspjelo.');
            return (await response.json()).map((entry) => ({
                ...entry,
                timestamp: new Date(entry.timestamp),
            }));
        },
    });
    return (
        <DiaryList
            gardenId={gardenId}
            entries={data}
            error={error}
            isLoading={isLoading}
        />
    );
}
