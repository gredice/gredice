import type { EntityStandardized } from '@gredice/storage';
import { CardOverflow } from '@gredice/ui/Card';
import { Sprout } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

export type RaisedBedMobileFieldListItem = {
    harvestedDate: string;
    key: string;
    plannedDate: string;
    plantName: string;
    plantSort: EntityStandardized | null;
    positionNumber: number;
    readyDate: string;
    sowingDate: string;
    statusControl: ReactNode;
};

export function RaisedBedMobileFieldList({
    items,
}: {
    items: RaisedBedMobileFieldListItem[];
}) {
    return (
        <CardOverflow className="md:hidden" data-raised-bed-mobile-list>
            <div className="divide-y border-t">
                {items.map((item) => (
                    <div className="space-y-3 p-4" key={item.key}>
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                                {item.plantSort ? (
                                    <PlantOrSortImage
                                        alt={item.plantName}
                                        className="size-12 object-cover"
                                        height={48}
                                        plantSort={item.plantSort}
                                        width={48}
                                    />
                                ) : (
                                    <Sprout
                                        aria-hidden
                                        className="size-6 text-muted-foreground/60"
                                    />
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="min-w-0">
                                    <Typography
                                        className="font-semibold text-primary"
                                        level="body3"
                                    >
                                        Pozicija {item.positionNumber}
                                    </Typography>
                                    <Typography
                                        className="break-words"
                                        data-raised-bed-plant-name
                                        level="body1"
                                        semiBold
                                    >
                                        {item.plantName}
                                    </Typography>
                                </div>
                                <div>{item.statusControl}</div>
                            </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
                            <div className="min-w-0 space-y-1">
                                <dt className="text-sm text-muted-foreground">
                                    Planirano
                                </dt>
                                <dd className="text-sm tabular-nums">
                                    {item.plannedDate}
                                </dd>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <dt className="text-sm text-muted-foreground">
                                    Posijano
                                </dt>
                                <dd className="text-sm tabular-nums">
                                    {item.sowingDate}
                                </dd>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <dt className="text-sm text-muted-foreground">
                                    Spremno
                                </dt>
                                <dd className="text-sm tabular-nums">
                                    {item.readyDate}
                                </dd>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <dt className="text-sm text-muted-foreground">
                                    Ubrano
                                </dt>
                                <dd className="text-sm tabular-nums">
                                    {item.harvestedDate}
                                </dd>
                            </div>
                        </dl>
                    </div>
                ))}
            </div>
        </CardOverflow>
    );
}
