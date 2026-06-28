import {
    plantFieldStatusLabel,
    userAllowedPlantStatusTransitions,
} from '@gredice/js/plants';
import {
    Book,
    Check,
    ExternalLink,
    Hammer,
    History,
    Home,
    MoreHorizontal,
    Sprout,
    Warning,
} from '@gredice/ui/icons';
import { Link } from '@gredice/ui/Link';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Stack } from '@gredice/ui/Stack';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Typography } from '@gredice/ui/Typography';
import { type ReactElement, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { KnownPages } from '../../knownPages';
import { GameModal } from '../../shared-ui/game-modal';
import { ScrollView } from '../../shared-ui/ScrollView';
import {
    findRaisedBedFieldWithPlant,
    findRaisedBedOccupiedField,
    type RaisedBedFieldPlantHistoryEntry,
} from '../../utils/raisedBedFields';
import { GreenhouseSeedlingPlantVisual } from './GreenhouseSeedlingPlantVisual';
import { GreenhouseSeedlingProgress } from './GreenhouseSeedlingProgress';
import { GreenhouseSeedlingTransplantAction } from './GreenhouseSeedlingTransplantAction';
import {
    isGreenhouseSeedlingField,
    useGreenhouseSeedlingProgressData,
} from './greenhouseSeedlings';
import { plantFieldStatusEmoji } from './PlantFieldStatusEmoji';
import { RaisedBedFieldIconStack } from './RaisedBedFieldIconStack';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import {
    RaisedBedFieldLifecycleTab,
    useRaisedBedFieldLifecycleData,
} from './RaisedBedFieldLifecycleTab';
import { RaisedBedFieldOperationsTab } from './RaisedBedFieldOperationsTab';
import { RaisedBedFieldPlantHistoryModal } from './RaisedBedFieldPlantHistoryModal';
import { RaisedBedFieldStatusChange } from './RaisedBedFieldStatusChange';
import { RaisedBedOperationHistoryList } from './RaisedBedOperationHistoryList';
import { RaisedBedPhotosModal } from './RaisedBedPhotosModal';
import { RecommendationsCard } from './RecommendationsCard';
import {
    parseScheduledSowingDateValue,
    ScheduledSowingDateBadge,
} from './ScheduledSowingDateBadge';

type RaisedBedFieldTabValue = 'lifecycle' | 'diary' | 'operations';

export function RaisedBedFieldItemPlanted({
    raisedBedId,
    positionIndex,
    fieldOverride,
    onOpenChange,
    open: openProp,
    plantHistory = [],
    isHistorical = false,
    triggerOverride,
    triggerVariant = 'field',
}: {
    raisedBedId: number;
    positionIndex: number;
    fieldOverride?: RaisedBedFieldPlantHistoryEntry;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
    plantHistory?: RaisedBedFieldPlantHistoryEntry[];
    isHistorical?: boolean;
    triggerOverride?: ReactElement | null;
    triggerVariant?: 'field' | 'avatar';
}) {
    const { data: garden, isLoading: isGardenLoading } = useCurrentGarden();
    const { track } = useGameAnalytics();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const field =
        fieldOverride ??
        (isHistorical
            ? findRaisedBedFieldWithPlant(raisedBed?.fields, positionIndex)
            : findRaisedBedOccupiedField(raisedBed?.fields, positionIndex));
    const plantSortId = field?.plantSortId;
    const { data: plantSort, isLoading: isPlantSortLoading } =
        usePlantSort(plantSortId);
    const lifecycleData = useRaisedBedFieldLifecycleData(
        raisedBedId,
        positionIndex,
        isHistorical,
        fieldOverride,
    );
    const {
        germinationValue,
        germinationPercentage,
        growthValue,
        growthPercentage,
        harvestValue,
        harvestPercentage,
    } = lifecycleData;
    const plantAttributes = plantSort?.information.plant.attributes;
    const greenhouseSeedlingLifecycleData = useGreenhouseSeedlingProgressData(
        field,
        plantAttributes,
    );
    const isGreenhouseSeedling =
        !isHistorical && isGreenhouseSeedlingField(field);
    const isHarvested = field?.plantHarvestedDate;
    const [internalOpen, setInternalOpen] = useState(false);
    const [activeTab, setActiveTab] =
        useState<RaisedBedFieldTabValue>('lifecycle');
    const isOpenControlled = openProp !== undefined;
    const open = openProp ?? internalOpen;

    if (!raisedBed) {
        return null;
    }
    if (!field?.plantSortId) {
        console.error(
            `Field not found for raised bed ${raisedBedId} at position index ${positionIndex}`,
            raisedBed.fields,
        );
        return null;
    }

    // Loading state
    const isLoading =
        isGardenLoading || (Boolean(plantSortId) && isPlantSortLoading);
    if (isLoading) {
        if (triggerOverride !== undefined) {
            return triggerOverride;
        }

        if (triggerVariant === 'avatar') {
            return null;
        }

        return (
            <RaisedBedFieldItemButton
                isLoading={true}
                positionIndex={positionIndex}
            />
        );
    }

    // Error state (plant sort unknown)
    if (!plantSort) {
        if (triggerOverride !== undefined) {
            return triggerOverride;
        }

        if (triggerVariant === 'avatar') {
            return null;
        }

        return (
            <RaisedBedFieldItemButton positionIndex={positionIndex}>
                <Warning className="size-10" />
            </RaisedBedFieldItemButton>
        );
    }

    const segments =
        field.toBeRemoved || field.plantDeadDate
            ? [
                  {
                      value: 100,
                      percentage: 100,
                      color: 'stroke-red-500',
                      trackColor: 'stroke-red-50 dark:stroke-red-50/80',
                  },
              ]
            : [
                  {
                      value: germinationValue,
                      percentage: germinationPercentage,
                      color: 'stroke-yellow-500',
                      trackColor: 'stroke-yellow-50 dark:stroke-yellow-50/80',
                      pulse: !field.plantGrowthDate,
                      borderColor: 'stroke-yellow-500',
                  },
                  {
                      value: growthValue,
                      percentage: growthPercentage,
                      color: 'stroke-green-500',
                      trackColor: 'stroke-green-50 dark:stroke-green-50/80',
                      pulse: !field.plantReadyDate,
                      borderColor: 'stroke-green-500',
                  },
                  {
                      value: harvestValue,
                      percentage: harvestPercentage,
                      color: 'stroke-blue-500',
                      trackColor: 'stroke-blue-50 dark:stroke-blue-50/80',
                      pulse: Boolean(harvestValue) && harvestValue < 100,
                      borderColor: 'stroke-blue-500',
                  },
              ];

    const plantDetailsUrl = KnownPages.GredicePlantSort(
        plantSort.information.plant.information?.name ??
            plantSort.information.name,
        plantSort.information.name,
    );
    const title = `${isHistorical ? 'Prethodna biljka' : 'Biljka'} "${plantSort.information.name}"`;
    const modalTitle = isGreenhouseSeedling
        ? `Sadnica u stakleniku "${plantSort.information.name}"`
        : title;
    const openPlantDetails = () => {
        track('game_planted_item_opened', {
            active_tab: activeTab,
            is_historical: isHistorical,
            plant_sort_id: plantSort.id,
            position_index: positionIndex,
            raised_bed_id: raisedBedId,
        });
        if (!isOpenControlled) {
            setInternalOpen(true);
        }
        onOpenChange?.(true);
    };
    const fieldBadge = isHistorical
        ? {
              className: 'bg-muted',
              icon: <History className="size-4 text-muted-foreground" />,
          }
        : isGreenhouseSeedling
          ? {
                className: 'bg-emerald-600',
                icon: <Home className="size-4 text-white" />,
            }
          : harvestValue && !isHarvested
            ? {
                  className: 'bg-blue-600',
                  icon: <Sprout className="size-4 text-white" />,
              }
            : isHarvested
              ? {
                    className: 'bg-green-600',
                    icon: <Check className="size-4 text-white" />,
                }
              : null;
    const scheduledSowingDate = parseScheduledSowingDateValue(
        field.plantScheduledDate,
    );
    const shouldShowScheduledSowingDate =
        triggerVariant === 'field' &&
        Boolean(scheduledSowingDate) &&
        !field.plantSowDate;
    const visiblePlantHistory =
        triggerVariant === 'field' ? plantHistory.slice(-2) : [];
    const shouldShowAllPlantHistory =
        triggerVariant === 'field' && plantHistory.length > 2;
    const shouldShowIndicatorStack =
        triggerVariant === 'field' &&
        (Boolean(fieldBadge) || plantHistory.length > 0);
    const greenhouseRecommendationStatus =
        isGreenhouseSeedling &&
        (field.plantStatus === 'pendingVerification' ||
            field.plantStatus === 'sowed' ||
            field.plantStatus === 'sprouted')
            ? field.plantStatus
            : undefined;
    const localizedStatus = plantFieldStatusLabel(
        field.plantStatus ?? undefined,
    );
    const canChangeStatus = Boolean(
        field.plantStatus &&
            userAllowedPlantStatusTransitions[field.plantStatus]?.length,
    );
    const statusContent = (
        <>
            <span className="text-2xl leading-none" aria-hidden="true">
                {plantFieldStatusEmoji(field.plantStatus ?? undefined)}
            </span>
            <Typography level="body1" className="text-center" semiBold>
                {localizedStatus.shortLabel}
            </Typography>
        </>
    );
    const statusTrigger = field.active ? (
        <button
            type="button"
            className="border bg-card rounded-full shrink-0 size-[100px] aspect-square shadow flex flex-col gap-1 items-center justify-center pointer-events-auto transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2"
            aria-label={
                canChangeStatus
                    ? `Promijeni stanje biljke: ${localizedStatus.shortLabel}`
                    : `Stanje biljke: ${localizedStatus.shortLabel}`
            }
        >
            {statusContent}
        </button>
    ) : (
        <Stack
            alignItems="center"
            className="border bg-card rounded-full shrink-0 size-[100px] aspect-square shadow flex items-center justify-center"
        >
            {statusContent}
        </Stack>
    );
    const avatarTrigger = (
        <button
            type="button"
            className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white p-0.5 hover:bg-gray-100 shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
            title={`Povijest biljke: ${plantSort.information.name}`}
            aria-label={`Povijest biljke ${plantSort.information.name}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <PlantOrSortImage
                plantSort={plantSort}
                width={26}
                height={26}
                className="size-full rounded-full object-cover"
            />
        </button>
    );
    const greenhouseSeedlingSegments = [
        {
            value: greenhouseSeedlingLifecycleData.germinationValue,
            percentage: greenhouseSeedlingLifecycleData.germinationPercentage,
            color: 'stroke-yellow-500',
            trackColor: 'stroke-yellow-50 dark:stroke-yellow-50/80',
            pulse: !field.plantGrowthDate,
            borderColor: 'stroke-yellow-500',
        },
        {
            value: greenhouseSeedlingLifecycleData.seedlingValue,
            percentage: greenhouseSeedlingLifecycleData.seedlingPercentage,
            color: 'stroke-emerald-500',
            trackColor: 'stroke-emerald-50 dark:stroke-emerald-50/80',
            pulse:
                Boolean(field.plantGrowthDate) &&
                greenhouseSeedlingLifecycleData.seedlingValue < 100,
            borderColor: 'stroke-emerald-500',
        },
    ];
    const fieldTrigger = (
        <RaisedBedFieldItemButton positionIndex={positionIndex}>
            <SegmentedCircularProgress
                size={70}
                strokeWidth={4}
                segments={
                    isGreenhouseSeedling ? greenhouseSeedlingSegments : segments
                }
            >
                {isGreenhouseSeedling ? (
                    <GreenhouseSeedlingPlantVisual
                        plantSort={plantSort}
                        imageSize={52}
                    />
                ) : (
                    <PlantOrSortImage
                        plantSort={plantSort}
                        className="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2"
                        width={52}
                        height={52}
                    />
                )}
            </SegmentedCircularProgress>
            {shouldShowScheduledSowingDate && scheduledSowingDate && (
                <ScheduledSowingDateBadge date={scheduledSowingDate} />
            )}
        </RaisedBedFieldItemButton>
    );
    const indicatorStack = shouldShowIndicatorStack ? (
        <RaisedBedFieldIconStack>
            {shouldShowAllPlantHistory && (
                <RaisedBedFieldPlantHistoryModal
                    entries={plantHistory}
                    raisedBedId={raisedBedId}
                    trigger={
                        <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-white p-0 shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
                            title={`Povijest biljaka (${plantHistory.length})`}
                            aria-label={`Prikaži povijest biljaka za polje ${positionIndex + 1}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                        >
                            <MoreHorizontal className="size-5" />
                        </button>
                    }
                />
            )}
            {visiblePlantHistory.map((historyEntry) => (
                <RaisedBedFieldItemPlanted
                    key={
                        historyEntry.plantPlaceEventId ??
                        `${historyEntry.positionIndex}-${historyEntry.plantSortId}`
                    }
                    fieldOverride={historyEntry}
                    isHistorical
                    positionIndex={positionIndex}
                    raisedBedId={raisedBedId}
                    triggerVariant="avatar"
                />
            ))}
            {fieldBadge && (
                <button
                    type="button"
                    className={`inline-flex size-8 items-center justify-center p-1 ${fieldBadge.className} pointer-events-auto rounded-full border-2 border-white shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700`}
                    title={modalTitle}
                    aria-label={modalTitle}
                    onPointerDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        openPlantDetails();
                    }}
                >
                    {fieldBadge.icon}
                </button>
            )}
        </RaisedBedFieldIconStack>
    ) : null;
    const defaultTrigger =
        triggerVariant === 'avatar' ? avatarTrigger : fieldTrigger;
    const trigger =
        triggerOverride === undefined ? defaultTrigger : triggerOverride;

    const modal = (
        <GameModal
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    track('game_planted_item_opened', {
                        active_tab: activeTab,
                        is_historical: isHistorical,
                        plant_sort_id: plantSort.id,
                        position_index: positionIndex,
                        raised_bed_id: raisedBedId,
                    });
                }
                if (!isOpenControlled) {
                    setInternalOpen(nextOpen);
                }
                onOpenChange?.(nextOpen);
            }}
            title={modalTitle}
            className="max-w-xl overflow-x-hidden"
            trigger={trigger ?? undefined}
        >
            <Stack spacing={4} className="min-w-0 max-w-full">
                <Row spacing={4} className="items-start pr-8">
                    {isGreenhouseSeedling ? (
                        <GreenhouseSeedlingPlantVisual
                            plantSort={plantSort}
                            imageSize={60}
                        />
                    ) : (
                        <PlantOrSortImage
                            plantSort={plantSort}
                            width={60}
                            height={60}
                        />
                    )}
                    <Stack spacing={1} className="min-w-0 flex-1">
                        <Typography
                            level="h4"
                            component="h1"
                            className="truncate line-clamp-2"
                            title={plantSort.information.name}
                        >
                            {plantSort.information.name}
                        </Typography>
                        <Link
                            href={plantDetailsUrl}
                            target="_blank"
                            aria-label="Detalji o biljci"
                            className="inline-flex mb-1 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-muted-foreground/60 shrink-0"
                            onClick={() =>
                                track('game_field_plant_details_opened', {
                                    plant_sort_id: plantSort.id,
                                    position_index: positionIndex,
                                    raised_bed_id: raisedBedId,
                                })
                            }
                        >
                            <ExternalLink className="size-4" />
                            <span>Detalji</span>
                        </Link>
                    </Stack>
                    {garden && !isHistorical && (
                        <RaisedBedPhotosModal
                            gardenId={garden.id}
                            raisedBedId={raisedBedId}
                            subjectName={plantSort.information.name}
                            positionIndex={positionIndex}
                        />
                    )}
                </Row>
                <Tabs
                    value={activeTab}
                    onValueChange={(value: string) => {
                        track('game_raised_bed_tab_opened', {
                            plant_sort_id: plantSort.id,
                            position_index: positionIndex,
                            raised_bed_id: raisedBedId,
                            tab: value,
                        });
                        setActiveTab(value as RaisedBedFieldTabValue);
                    }}
                    className="flex flex-col"
                >
                    <TabsList className="border w-fit self-center">
                        <TabsTrigger value="lifecycle">
                            <Row spacing={2}>
                                <Sprout className="size-4 shrink-0" />
                                <Typography>Biljka</Typography>
                            </Row>
                        </TabsTrigger>
                        <TabsTrigger value="diary">
                            <Row spacing={2}>
                                <Book className="size-4 shrink-0" />
                                <Typography>Dnevnik</Typography>
                            </Row>
                        </TabsTrigger>
                        {!isHistorical && (
                            <TabsTrigger value="operations">
                                <Row spacing={2}>
                                    <Hammer className="size-4 shrink-0" />
                                    <Typography>Radnje</Typography>
                                </Row>
                            </TabsTrigger>
                        )}
                    </TabsList>
                    {!isHistorical && (
                        <TabsContent value="operations">
                            {garden && (
                                <RaisedBedFieldOperationsTab
                                    gardenId={garden.id}
                                    raisedBedId={raisedBedId}
                                    positionIndex={positionIndex}
                                    plantSortId={field.plantSortId}
                                />
                            )}
                        </TabsContent>
                    )}
                    <TabsContent value="diary">
                        {garden && (
                            <ScrollView
                                className="-mx-4 md:-mx-6"
                                viewportClassName="max-h-96"
                                contentClassName="pl-4 pr-2 md:pl-6 md:pr-2"
                            >
                                <RaisedBedOperationHistoryList
                                    raisedBedId={raisedBed.id}
                                    positionIndex={positionIndex}
                                    disableActions={isHistorical}
                                />
                            </ScrollView>
                        )}
                    </TabsContent>
                    <TabsContent value="lifecycle">
                        <Stack spacing={4}>
                            {isGreenhouseSeedling ? (
                                <GreenhouseSeedlingProgress
                                    field={field}
                                    plantAttributes={plantAttributes}
                                    lifecycleData={
                                        greenhouseSeedlingLifecycleData
                                    }
                                    plantDetailsUrl={plantDetailsUrl}
                                    statusTrigger={
                                        field.active ? (
                                            <RaisedBedFieldStatusChange
                                                raisedBedId={raisedBedId}
                                                positionIndex={positionIndex}
                                                currentStatus={
                                                    field.plantStatus ??
                                                    undefined
                                                }
                                                trigger={statusTrigger}
                                            />
                                        ) : (
                                            statusTrigger
                                        )
                                    }
                                />
                            ) : (
                                <RaisedBedFieldLifecycleTab
                                    raisedBedId={raisedBedId}
                                    positionIndex={positionIndex}
                                    fieldOverride={fieldOverride}
                                    includeInactive={isHistorical}
                                    onShowOperations={() =>
                                        setActiveTab('operations')
                                    }
                                />
                            )}
                            {isGreenhouseSeedling && garden && (
                                <GreenhouseSeedlingTransplantAction
                                    gardenId={garden.id}
                                    raisedBedId={raisedBedId}
                                    positionIndex={positionIndex}
                                />
                            )}
                            {isGreenhouseSeedling &&
                                garden &&
                                greenhouseRecommendationStatus &&
                                typeof field.plantSortId === 'number' && (
                                    <RecommendationsCard
                                        onShowOperations={() =>
                                            setActiveTab('operations')
                                        }
                                        gardenId={garden.id}
                                        raisedBedId={raisedBedId}
                                        positionIndex={positionIndex}
                                        plantStatus={
                                            greenhouseRecommendationStatus
                                        }
                                        plantSortId={field.plantSortId}
                                    />
                                )}
                        </Stack>
                    </TabsContent>
                </Tabs>
                <button
                    type="button"
                    className="sm:hidden self-end rounded-md border px-3 py-1.5 text-sm font-medium"
                    onClick={() => {
                        if (!isOpenControlled) {
                            setInternalOpen(false);
                        }
                        onOpenChange?.(false);
                    }}
                >
                    Zatvori
                </button>
            </Stack>
        </GameModal>
    );

    if (triggerOverride === undefined && triggerVariant === 'field') {
        return (
            <div className="relative size-full">
                {modal}
                {indicatorStack}
            </div>
        );
    }

    return modal;
}
