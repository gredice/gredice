'use client';

import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { getPlants } from "@gredice/storage";
import { Card } from "@signalco/ui-primitives/Card";
import Link from "next/link";
import Image from "next/image";
import { useSearchParam } from "@signalco/hooks/useSearchParam";

export function PlantsGallery({ plants }: { plants: Awaited<ReturnType<typeof getPlants>> }) {
    const [search] = useSearchParam('pretraga');

    const filteredPlants = plants.filter(plant => !search || plant.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex gap-4 flex-wrap">
            {filteredPlants.length === 0 && (
                <Typography level="body2">Nema rezultata pretrage.</Typography>
            )}
            {filteredPlants.map(plant => (
                <Link key={plant.id} href={`/biljke/${plant.id}`} passHref>
                    <Card key={plant.id} className="w-40 h-[232px]">
                        <Stack spacing={2} alignItems="center">
                            <div className="p-1">
                                <Image
                                    src={plant.imageUrl}
                                    alt={plant.name}
                                    width={144}
                                    height={144} />
                            </div>
                            <Typography level="h5" center className="line-clamp-2">{plant.name}</Typography>
                        </Stack>
                    </Card>
                </Link>
            ))}
        </div>
    );
}