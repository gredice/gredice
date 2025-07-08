import { client } from "@gredice/client";
import { Chip } from "@signalco/ui-primitives/Chip";
import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { Row } from "@signalco/ui-primitives/Row";
import { Spinner } from "@signalco/ui-primitives/Spinner";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Alert } from "@signalco/ui/Alert";
import { useQuery } from "@tanstack/react-query";

function useRaiedBedDiaryEntries(gardenId: number, raisedBedId: number) {
    return useQuery({
        queryKey: ["raisedBeds", raisedBedId, 'diary'],
        queryFn: async () => {
            const entries = await client().api.gardens[":gardenId"]["raised-beds"][":raisedBedId"]["diary-entries"].$get({
                param: {
                    gardenId: gardenId.toString(),
                    raisedBedId: raisedBedId.toString(),
                },
            });
            if (entries.status === 400) {
                console.error('Failed to fetch diary entries - bad request', entries);
                return [];
            }
            if (entries.status === 404) {
                console.error('Raised bed not found or no diary entries available', entries);
                return [];
            }
            return (await entries.json()).map(entry => ({
                ...entry,
                timestamp: new Date(entry.timestamp),
            }));
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: Boolean(gardenId) && Boolean(raisedBedId),
    });
}

export function RaisedBedDiary({ gardenId, raisedBedId }: { gardenId: number; raisedBedId: number }) {
    const { data: entries, isLoading, error } = useRaiedBedDiaryEntries(gardenId, raisedBedId);
    return (
        <List>
            {error && (
                <Alert color="danger">
                    <Typography level="body2">Došlo je do pogreške prilikom učitavanja dnevnika gredice. Pokušaj ponovno.</Typography>
                </Alert>
            )}
            {isLoading && (
                <Spinner loading loadingLabel="Učitavanje dnevnika gredice..." className="w-full my-8 flex items-center justify-center" />
            )}
            {(!isLoading && !entries?.length) && (
                <ListItem label={<Typography level="body2">Nema unosa u dnevniku gredice.</Typography>} />
            )}
            {entries?.map(entry => (
                <ListItem
                    key={entry.id}
                    label={(
                        <Row spacing={2} justifyContent="space-between">
                            <Stack>
                                <Typography level="body1">{entry.name}</Typography>
                                <Typography level="body2">{entry.description}</Typography>
                            </Stack>
                            {entry.status && (
                                <Stack>
                                    <Chip
                                        color={entry.status === 'Završeno' ? 'success' : entry.status === 'Planirano' ? 'info' : 'neutral'}
                                        className="shrink-0"
                                    >
                                        {entry.status}
                                    </Chip>
                                    <Typography level="body2">{entry.timestamp.toLocaleDateString('hr-HR')}</Typography>
                                </Stack>
                            )}
                        </Row>
                    )}
                />
            ))}
        </List>
    );
}