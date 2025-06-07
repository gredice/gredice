import { PlantSortData } from "@gredice/client";
import { Card } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import Link from "next/link";
import { KnownPages } from "../../src/KnownPages";

export function PlantSortsList({ sorts, basePlantName }: { sorts: PlantSortData[]; basePlantName: string }) {
    if (!sorts.length) return null;
    return (
        <Stack spacing={2}>
            <Typography level="h2" className="text-2xl">Sorte</Typography>
            <Stack spacing={2}>
                {sorts.map(sort => (
                    <Card key={sort.id} className="p-4">
                        <Link href={KnownPages.Plant(`${basePlantName}/sorta/${sort.information.name}`)}>
                            <Typography level="h3" className="text-lg font-semibold">{sort.information.name}</Typography>
                        </Link>
                        <Typography level="body2">{sort.information.plant.information?.description}</Typography>
                    </Card>
                ))}
            </Stack>
        </Stack>
    );
}
