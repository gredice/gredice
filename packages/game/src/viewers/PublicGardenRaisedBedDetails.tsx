'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Close, Sprout } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { RaisedBedSimpleIcon } from '@gredice/ui/RaisedBedSimpleIcon';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useMemo, useRef } from 'react';
import { useAllSorts } from '../hooks/usePlantSorts';
import {
    getPublicGardenActivePlantFields,
    getPublicGardenPlantCountLabel,
    getPublicGardenPlantLocationLabel,
    getPublicGardenPlantMilestones,
    getPublicGardenPlantStatusColor,
    type PublicGardenRaisedBed,
} from './publicGardenRaisedBedDetailsModel';

export function PublicGardenRaisedBedDetails({
    onClose,
    raisedBed,
}: {
    onClose: () => void;
    raisedBed: PublicGardenRaisedBed;
}) {
    const panelRef = useRef<HTMLElement>(null);
    const { data: plantSorts } = useAllSorts();
    const plantSortById = useMemo(
        () =>
            new Map(plantSorts?.map((plantSort) => [plantSort.id, plantSort])),
        [plantSorts],
    );
    const fields = getPublicGardenActivePlantFields(raisedBed);
    const titleId = `public-raised-bed-${raisedBed.id.toString()}-title`;

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        panelRef.current?.focus();

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (
                previouslyFocused instanceof HTMLElement &&
                previouslyFocused !== document.body &&
                previouslyFocused.isConnected
            ) {
                previouslyFocused.focus();
                return;
            }

            document
                .querySelector<HTMLSelectElement>(
                    '[data-public-garden-raised-bed-picker]',
                )
                ?.focus();
        };
    }, [onClose]);

    return (
        <section
            ref={panelRef}
            aria-labelledby={titleId}
            className="absolute inset-x-2 bottom-2 z-30 flex max-h-[72%] min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-background/95 shadow-2xl backdrop-blur-xl outline-hidden md:inset-y-3 md:right-3 md:left-auto md:max-h-none md:w-[min(420px,calc(100%-1.5rem))]"
            role="dialog"
            tabIndex={-1}
        >
            <div className="flex shrink-0 items-start gap-3 border-b bg-background/90 p-4 pr-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <RaisedBedSimpleIcon aria-hidden className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                    <Typography
                        id={titleId}
                        level="h5"
                        component="h2"
                        className="truncate"
                    >
                        {raisedBed.name}
                    </Typography>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Chip
                            color={fields.length > 0 ? 'success' : 'neutral'}
                            size="sm"
                            startDecorator={<Sprout aria-hidden />}
                            variant="soft"
                        >
                            {getPublicGardenPlantCountLabel(fields.length)}
                        </Chip>
                        <Chip color="neutral" size="sm" variant="outlined">
                            Samo za gledanje
                        </Chip>
                    </div>
                </div>
                <IconButton
                    aria-label="Zatvori detalje gredice"
                    className="shrink-0 rounded-full"
                    onClick={onClose}
                    size="sm"
                    variant="plain"
                >
                    <Close aria-hidden className="size-4" />
                </IconButton>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {fields.length > 0 ? (
                    <div className="divide-y overflow-hidden rounded-xl border bg-card">
                        {fields.map((field) => {
                            const plantSort =
                                typeof field.plantSortId === 'number'
                                    ? plantSortById.get(field.plantSortId)
                                    : undefined;
                            const status = plantFieldStatusLabel(
                                field.plantStatus ?? undefined,
                            );
                            const milestones =
                                getPublicGardenPlantMilestones(field);
                            const locationLabel =
                                getPublicGardenPlantLocationLabel(field);
                            const plantName =
                                plantSort?.information.plant.information?.name;
                            const sortName =
                                plantSort?.information.name ?? 'Biljka';

                            return (
                                <article
                                    className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-3 p-3"
                                    key={field.id}
                                >
                                    <PlantOrSortImage
                                        plantSort={plantSort}
                                        alt={sortName}
                                        className="size-14 rounded-lg border bg-muted object-cover"
                                        height={56}
                                        width={56}
                                    />
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                    className="truncate"
                                                >
                                                    {sortName}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                    className="truncate"
                                                >
                                                    {plantName
                                                        ? `${plantName} · polje ${(field.positionIndex + 1).toString()}`
                                                        : `Polje ${(field.positionIndex + 1).toString()}`}
                                                </Typography>
                                                {locationLabel ? (
                                                    <Chip
                                                        className="mt-1"
                                                        color={
                                                            locationLabel ===
                                                            'U plasteniku'
                                                                ? 'warning'
                                                                : 'neutral'
                                                        }
                                                        size="sm"
                                                        variant="outlined"
                                                    >
                                                        {locationLabel}
                                                    </Chip>
                                                ) : null}
                                            </div>
                                            <Chip
                                                color={getPublicGardenPlantStatusColor(
                                                    field.plantStatus,
                                                )}
                                                size="sm"
                                                variant="soft"
                                            >
                                                {status.shortLabel}
                                            </Chip>
                                        </div>

                                        {milestones.length > 0 ? (
                                            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                                                {milestones.map((milestone) => (
                                                    <div
                                                        className="min-w-0"
                                                        key={milestone.label}
                                                    >
                                                        <dt className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                                                            <Calendar
                                                                aria-hidden
                                                                className="size-3 shrink-0"
                                                            />
                                                            {milestone.label}
                                                        </dt>
                                                        <dd className="truncate text-xs font-medium">
                                                            {milestone.value}
                                                        </dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        ) : (
                                            <Typography
                                                level="body3"
                                                secondary
                                                className="mt-2"
                                            >
                                                Datum sadnje još nije
                                                zabilježen.
                                            </Typography>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card/70 p-6 text-center">
                        <Sprout
                            aria-hidden
                            className="mb-3 size-8 text-muted-foreground"
                        />
                        <Typography level="body2" semiBold>
                            Gredica je trenutačno prazna
                        </Typography>
                        <Typography
                            level="body3"
                            secondary
                            className="mt-1 max-w-64"
                        >
                            U ovoj gredici trenutačno nema aktivnih biljaka.
                        </Typography>
                    </div>
                )}
            </div>
        </section>
    );
}
