'use client';

import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Card } from "@signalco/ui-primitives/Card";
import Link from "next/link";
import Image from "next/image";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { PlantData } from "./[plantId]/page";

export function PlantsGallery({ plants }: { plants: PlantData[] }) {
    const [search] = useSearchParam('pretraga');

    const filteredPlants = plants.filter(plant => !search || plant.information.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex gap-4 flex-wrap">
            {filteredPlants.length === 0 && (
                <Typography level="body2">Nema rezultata pretrage.</Typography>
            )}
            {filteredPlants.map(plant => (
                <Link key={plant.id} href={`/biljke/${plant.id}`} passHref>
                    <Card key={plant.id} className="w-40 h-[232px]">
                        <Stack spacing={2} alignItems="center">
                            <div className="p-4">
                                <Image
                                    src={plant.image?.cover?.url ?? '/assets/plants/placeholder.png'}
                                    alt={plant.information.name}
                                    width={144}
                                    height={144} />
                            </div>
                            <Typography level="h5" center className="line-clamp-2">{plant.information.name}</Typography>
                        </Stack>
                    </Card>
                </Link>
            ))}
        </div>
    );
}