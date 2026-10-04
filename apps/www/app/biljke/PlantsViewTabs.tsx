'use client';

import { GameCalendarIcon, GameGardenPlanIcon } from '@gredice/ui/GameIcons';
import { Row } from '@gredice/ui/Row';
import { TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import Link from 'next/link';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { plantArchivePath } from './plantArchivePath';

export function PlantsViewTabs({
    search,
    seedTimeOnly,
}: {
    search: string;
    seedTimeOnly: boolean;
}) {
    const [currentSearch] = useClientSearchParam('pretraga', search);
    const [seedTimeFilter] = useClientSearchParam(
        'vrijemeZaSijanje',
        seedTimeOnly ? '1' : '',
    );
    return (
        <TabsList className="grid grid-cols-2 w-fit border">
            <TabsTrigger value="popis" className="w-full" asChild>
                <Link
                    href={plantArchivePath({
                        search: currentSearch,
                        seedTimeOnly: seedTimeFilter === '1',
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
                        search: currentSearch,
                        seedTimeOnly: seedTimeFilter === '1',
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
