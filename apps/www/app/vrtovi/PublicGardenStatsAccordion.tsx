import { Accordion } from '@gredice/ui/Accordion';
import { LayoutGrid, Ruler, Wallet } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import {
    formatGardenAreaSquareMeters,
    formatGardenNumber,
    formatGardenSunflowerPrice,
    type PublicGardenStats,
} from './publicGardenFormatting';

export function PublicGardenStatsAccordion({
    stats,
}: {
    stats: PublicGardenStats;
}) {
    const statItems = [
        {
            id: 'area',
            icon: Ruler,
            label: 'Površina',
            value: formatGardenAreaSquareMeters(stats.areaSquareMeters),
        },
        {
            id: 'blocks',
            icon: LayoutGrid,
            label: 'Blokova',
            value: formatGardenNumber(stats.blockCount),
        },
        {
            id: 'sunflowers',
            icon: Wallet,
            label: 'Cijena blokova',
            value: formatGardenSunflowerPrice(stats.totalSunflowerPrice),
        },
    ];

    return (
        <div className="border-t">
            <Accordion variant="plain" className="rounded-none">
                <div className="min-w-0">
                    <Typography level="body2" className="font-medium">
                        Statistika vrta
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        Površina, blokovi i suncokreti
                    </Typography>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                    {statItems.map(({ icon: Icon, id, label, value }) => (
                        <div
                            className="flex min-w-0 items-start gap-3 rounded-md bg-muted/40 p-3"
                            key={id}
                        >
                            <Icon
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-primary"
                            />
                            <div className="min-w-0">
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    {label}
                                </Typography>
                                <Typography
                                    level="body2"
                                    className="truncate font-medium"
                                >
                                    {value}
                                </Typography>
                            </div>
                        </div>
                    ))}
                </div>
            </Accordion>
        </div>
    );
}
