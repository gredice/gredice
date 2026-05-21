import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Modal } from '@gredice/ui/Modal';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type ReactElement, useMemo, useState } from 'react';
import { useSorts } from '../../hooks/usePlantSorts';
import type { RaisedBedFieldPlantHistoryEntry } from '../../utils/raisedBedFields';
import { RaisedBedFieldItemPlanted } from './RaisedBedFieldItemPlanted';

function formatHistoryDate(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    return new Date(value).toLocaleDateString('hr-HR');
}

export function RaisedBedFieldPlantHistoryModal({
    entries,
    raisedBedId,
    trigger,
}: {
    entries: RaisedBedFieldPlantHistoryEntry[];
    raisedBedId: number;
    trigger: ReactElement;
}) {
    const plantSortIds = useMemo(
        () =>
            Array.from(
                new Set(
                    entries
                        .map((entry) => entry.plantSortId)
                        .filter((plantSortId): plantSortId is number =>
                            Boolean(plantSortId),
                        ),
                ),
            ),
        [entries],
    );
    const { data: plantSorts } = useSorts(plantSortIds);
    const plantSortById = new Map(
        plantSorts?.map((plantSort) => [plantSort.id, plantSort]) ?? [],
    );
    const [selectedEntry, setSelectedEntry] =
        useState<RaisedBedFieldPlantHistoryEntry | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const selectedEntryKey = selectedEntry
        ? (selectedEntry.plantPlaceEventId ??
          `${selectedEntry.positionIndex}-${selectedEntry.plantSortId}-${selectedEntry.startedAt ?? selectedEntry.plantSowDate ?? selectedEntry.plantScheduledDate ?? 'unknown'}`)
        : null;

    return (
        <>
            <Modal
                title="Povijest polja"
                trigger={trigger}
                modal={false}
                className="md:border-tertiary md:border-b-4 max-w-xl"
            >
                <Stack spacing={2}>
                    <Typography level="body2" className="text-muted-foreground">
                        Povijest biljaka na ovom polju.
                    </Typography>
                    {[...entries].reverse().map((entry) => {
                        const plantSort = entry.plantSortId
                            ? plantSortById.get(entry.plantSortId)
                            : undefined;
                        const plantName =
                            plantSort?.information.name ?? 'Nepoznata biljka';
                        const status = plantFieldStatusLabel(
                            entry.plantStatus ?? undefined,
                        );
                        const endDate = formatHistoryDate(
                            entry.plantRemovedDate ??
                                entry.plantHarvestedDate ??
                                entry.plantDeadDate ??
                                entry.endedAt,
                        );
                        const startDate = formatHistoryDate(
                            entry.plantSowDate ??
                                entry.plantScheduledDate ??
                                entry.startedAt,
                        );
                        const entryKey =
                            entry.plantPlaceEventId ??
                            `${entry.positionIndex}-${entry.plantSortId}-${startDate}`;

                        return (
                            <button
                                key={entryKey}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md border bg-card p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
                                aria-label={`Otvori detalje biljke ${plantName}`}
                                onClick={() => {
                                    setSelectedEntry(entry);
                                    setIsDetailsOpen(true);
                                }}
                            >
                                <div className="relative size-12 shrink-0 overflow-hidden">
                                    <PlantOrSortImage
                                        plantSort={plantSort ?? null}
                                        width={48}
                                        height={48}
                                        className="size-full object-cover"
                                    />
                                </div>
                                <Stack spacing={0.5} className="min-w-0">
                                    <Typography
                                        level="body1"
                                        semiBold
                                        className="truncate"
                                        title={plantName}
                                    >
                                        {plantName}
                                    </Typography>
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        {status.shortLabel}
                                        {startDate ? ` · ${startDate}` : ''}
                                        {endDate ? ` - ${endDate}` : ''}
                                    </Typography>
                                </Stack>
                            </button>
                        );
                    })}
                </Stack>
            </Modal>
            {selectedEntry && (
                <RaisedBedFieldItemPlanted
                    key={selectedEntryKey}
                    fieldOverride={selectedEntry}
                    isHistorical
                    onOpenChange={(open) => {
                        setIsDetailsOpen(open);
                        if (!open) {
                            setSelectedEntry(null);
                        }
                    }}
                    open={isDetailsOpen}
                    positionIndex={selectedEntry.positionIndex}
                    raisedBedId={raisedBedId}
                    triggerOverride={null}
                    triggerVariant="avatar"
                />
            )}
        </>
    );
}
