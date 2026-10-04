import { Card } from '@gredice/ui/Card';
import { GamePlantStatusIcon } from '@gredice/ui/GameIcons';
import { Sprout } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { RaisedBedIdentifierIcon } from '@gredice/ui/RaisedBedIdentifierIcon';
import type { getFieldPreviews } from './raisedBedFieldPreviews';
import { getRaisedBedPhysicalLayout } from './raisedBedPhysicalLayout';

export function RaisedBedsOverview({
    raisedBeds,
}: {
    raisedBeds: Array<{
        id: number;
        physicalId: string | null;
        name: string | null;
        fields: ReturnType<typeof getFieldPreviews>;
    }>;
}) {
    const { slots, rowCount } = getRaisedBedPhysicalLayout(raisedBeds);
    return (
        <section
            className="grid grid-cols-3 auto-rows-fr gap-1.5 sm:gap-3"
            aria-label="Raspored gredica"
            style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
            {slots.map((slot) => (
                <div
                    key={slot.key}
                    className="min-w-0 space-y-2"
                    style={{ gridRow: slot.row, gridColumn: slot.column }}
                >
                    {slot.beds.map((raisedBed) => (
                        <Card
                            key={raisedBed.id}
                            href={`/raised-beds/${raisedBed.id}`}
                            aria-label={`Gredica ${raisedBed.physicalId}: ${raisedBed.name || 'Bez naziva'}`}
                            className="min-w-0 cursor-pointer space-y-1 p-1 sm:space-y-2 sm:p-2"
                        >
                            <h2 className="flex min-w-0 items-center gap-1 text-[10px] font-semibold sm:text-sm">
                                <RaisedBedIdentifierIcon
                                    className="shrink-0 text-primary"
                                    physicalId={raisedBed.physicalId}
                                />
                                <span
                                    className="min-w-0 truncate"
                                    title={raisedBed.name ?? undefined}
                                >
                                    {raisedBed.name ||
                                        `Gredica ${raisedBed.physicalId}`}
                                </span>
                            </h2>
                            <div className="grid grid-cols-3 auto-rows-fr gap-0.5 sm:gap-1">
                                {raisedBed.fields.map((field) => (
                                    <div
                                        key={field.key}
                                        title={field.label}
                                        style={{
                                            gridRow: `${field.row} / span ${field.rowSpan}`,
                                            gridColumn: `${field.column} / span ${field.columnSpan}`,
                                            aspectRatio: `${3 * field.columnSpan} / ${2 * field.rowSpan}`,
                                        }}
                                        className={
                                            field.hasPlant
                                                ? 'relative flex min-w-0 items-center justify-center rounded border bg-muted/30 p-0.5'
                                                : 'min-w-0 rounded border border-dashed bg-muted/10'
                                        }
                                    >
                                        {field.plants.map((plant) => (
                                            <div
                                                key={plant.key}
                                                className="relative flex min-w-0 flex-1 items-center justify-center"
                                                title={`Polja ${plant.positionNumbers.join(', ')}${plant.statusLabel ? ` · ${plant.statusLabel}` : ''}${plant.plantCount != null ? ` · Broj biljaka: ${plant.plantCount}` : ''}`}
                                            >
                                                {plant.plantSort ? (
                                                    <PlantOrSortImage
                                                        plantSort={
                                                            plant.plantSort
                                                        }
                                                        width={32}
                                                        height={32}
                                                        className="size-5 max-w-full object-contain sm:size-8"
                                                    />
                                                ) : (
                                                    <Sprout className="size-4 text-primary sm:size-6" />
                                                )}
                                                {plant.status ? (
                                                    <GamePlantStatusIcon
                                                        status={plant.status}
                                                        className="absolute -right-0.5 -top-0.5 size-3 shrink-0 rounded-full bg-background/90 sm:size-4"
                                                        aria-hidden
                                                    />
                                                ) : null}
                                            </div>
                                        ))}
                                        <span className="sr-only">
                                            {field.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            ))}
        </section>
    );
}
