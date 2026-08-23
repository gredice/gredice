import type { EntityStandardized } from '@gredice/storage';
import { CardOverflow } from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

export type GreenhouseMobilePlantListItem = {
    germinationDate: string;
    key: string;
    plantName: string;
    plantSort: EntityStandardized | undefined;
    positionNumber: number;
    sowingDate: ReactNode;
    statusColor: ColorPaletteProp;
    statusEmoji: string;
    statusLabel: string;
};

export function GreenhouseMobilePlantList({
    items,
}: {
    items: GreenhouseMobilePlantListItem[];
}) {
    return (
        <CardOverflow className="md:hidden" data-greenhouse-mobile-list>
            <div className="divide-y border-t">
                {items.map((item) => (
                    <div className="space-y-3 p-4" key={item.key}>
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                                <PlantOrSortImage
                                    plantSort={item.plantSort}
                                    alt={item.plantName}
                                    width={48}
                                    height={48}
                                    className="size-12 object-cover"
                                />
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="min-w-0">
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        Polje {item.positionNumber}
                                    </Typography>
                                    <Typography
                                        level="body1"
                                        semiBold
                                        className="break-words"
                                        data-greenhouse-plant-name
                                    >
                                        {item.plantName}
                                    </Typography>
                                </div>
                                <Chip
                                    color={item.statusColor}
                                    size="sm"
                                    startDecorator={
                                        <span aria-hidden="true">
                                            {item.statusEmoji}
                                        </span>
                                    }
                                >
                                    {item.statusLabel}
                                </Chip>
                            </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-3 border-t pt-3">
                            <div className="min-w-0 space-y-1">
                                <dt className="text-sm text-muted-foreground">
                                    Posijano
                                </dt>
                                <dd className="text-sm">{item.sowingDate}</dd>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <dt className="text-sm text-muted-foreground">
                                    Proklijalo
                                </dt>
                                <dd className="text-sm tabular-nums">
                                    {item.germinationDate}
                                </dd>
                            </div>
                        </dl>
                    </div>
                ))}
            </div>
        </CardOverflow>
    );
}
