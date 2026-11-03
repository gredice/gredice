'use client';

import { GameCalendarIcon, GameGardenPlanIcon } from '@gredice/ui/GameIcons';
import { Row } from '@gredice/ui/Row';
import { TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import Link from 'next/link';
import { plantArchivePath } from './plantArchivePath';
import {
    type PlantArchiveFilterDefaults,
    usePlantArchiveFilters,
} from './usePlantArchiveFilters';

export function PlantsViewTabs({
    filters,
}: {
    filters: PlantArchiveFilterDefaults;
}) {
    const { activity, month, search } = usePlantArchiveFilters(filters);
    return (
        <TabsList className="grid grid-cols-2 w-fit border">
            <TabsTrigger value="popis" className="w-full" asChild>
                <Link
                    href={plantArchivePath({
                        activity,
                        month,
                        search,
                        view: 'popis',
                    })}
                    prefetch
                >
                    <Row spacing={2} className="cursor-default">
                        <GameGardenPlanIcon
                            aria-hidden
                            className="size-5 shrink-0"
                        />
                        <span className="text-foreground">Popis</span>
                    </Row>
                </Link>
            </TabsTrigger>
            <TabsTrigger value="kalendar" className="w-full" asChild>
                <Link
                    href={plantArchivePath({
                        activity,
                        month,
                        search,
                        view: 'kalendar',
                    })}
                    prefetch
                >
                    <Row spacing={2} className="cursor-default">
                        <GameCalendarIcon
                            aria-hidden
                            className="size-5 shrink-0"
                        />
                        <span className="text-foreground">Kalendar</span>
                    </Row>
                </Link>
            </TabsTrigger>
        </TabsList>
    );
}
