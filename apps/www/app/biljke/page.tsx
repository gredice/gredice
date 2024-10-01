import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { getPlants } from "../../lib/storage/repositories/plantsRepo";
import { Card } from "@signalco/ui-primitives/Card";
import Link from "next/link";

export default async function PlantsPage() {
    const plants = await getPlants();

    return (
        <Stack spacing={4}>
            <Typography>Plants</Typography>
            <Stack spacing={2}>
                {plants?.map(plant => (
                    <Link key={plant.id} href={`/biljke/${plant.id}`} passHref>
                        <Card key={plant.id}>
                            <Typography>{plant.name}</Typography>
                        </Card>
                    </Link>
                ))}
            </Stack>
        </Stack>
    );
}