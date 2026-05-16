import { PlantOrSortImage } from '@gredice/ui/plants';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import {
    Book,
    Check,
    ExternalLink,
    Hammer,
    History,
    MoreHorizontal,
    Sprout,
    Warning,
} from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Link } from '@signalco/ui-primitives/Link';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type ReactElement, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { KnownPages } from '../../knownPages';
import {
    findRaisedBedFieldWithPlant,
    findRaisedBedOccupiedField,
    type RaisedBedFieldPlantHistoryEntry,
} from '../../utils/raisedBedFields';
import { RaisedBedFieldDiary } from './RaisedBedDiary';
import { RaisedBedFieldIconStack } from './RaisedBedFieldIconStack';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import {
    RaisedBedFieldLifecycleTab,
    useRaisedBedFieldLifecycleData,
} from './RaisedBedFieldLifecycleTab';
import { RaisedBedFieldOperationsTab } from './RaisedBedFieldOperationsTab';
import { RaisedBedFieldPlantHistoryModal } from './RaisedBedFieldPlantHistoryModal';

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
    const {
        germinationValue,
        germinationPercentage,
        growthValue,
        growthPercentage,
        harvestValue,
        harvestPercentage,
    } = useRaisedBedFieldLifecycleData(
        raisedBedId,
        positionIndex,
        isHistorical,
        fieldOverride,
    );
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
    const fieldBadge = isHistorical
        ? {
              className: 'bg-muted',
              icon: <History className="size-4 text-muted-foreground" />,
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
    const visiblePlantHistory =
        triggerVariant === 'field' ? plantHistory.slice(-2) : [];
    const shouldShowAllPlantHistory =
        triggerVariant === 'field' && plantHistory.length > 2;
    const shouldShowIndicatorStack =
        triggerVariant === 'field' &&
        (Boolean(fieldBadge) || plantHistory.length > 0);
    const defaultTrigger =
        triggerVariant === 'avatar' ? (
            <button
                type="button"
                className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white p-0.5 hover:bg-gray-100 shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
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
        ) : (
            <div className="relative size-full">
                <RaisedBedFieldItemButton positionIndex={positionIndex}>
                    <SegmentedCircularProgress
                        size={70}
                        strokeWidth={4}
                        segments={segments}
                    >
                        <PlantOrSortImage
                            plantSort={plantSort}
                            className="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2"
                            width={52}
                            height={52}
                        />
                    </SegmentedCircularProgress>
                </RaisedBedFieldItemButton>
                {shouldShowIndicatorStack && (
                    <RaisedBedFieldIconStack>
                        {shouldShowAllPlantHistory && (
                            <RaisedBedFieldPlantHistoryModal
                                entries={plantHistory}
                                raisedBedId={raisedBedId}
                                trigger={
                                    <button
                                        type="button"
                                        className="inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-white p-0 shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
                                        title={`Povijest biljaka (${plantHistory.length})`}
                                        aria-label={`Prikaži povijest biljaka za polje ${positionIndex + 1}`}
                                        onPointerDown={(event) =>
                                            event.stopPropagation()
                                        }
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                        onKeyDown={(event) =>
                                            event.stopPropagation()
                                        }
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
                            <span
                                className={`inline-flex size-8 items-center justify-center p-1 ${fieldBadge.className} rounded-full border-2 border-white shadow-lg ring-1 ring-black/10`}
                            >
                                {fieldBadge.icon}
                            </span>
                        )}
                    </RaisedBedFieldIconStack>
                )}
            </div>
        );
    const trigger =
        triggerOverride === undefined ? defaultTrigger : triggerOverride;

    return (
        <Modal
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
            title={title}
            className="md:border-tertiary md:border-b-4 max-w-xl"
            trigger={trigger ?? undefined}
        >
            <Stack spacing={2}>
                <Row spacing={2}>
                    <PlantOrSortImage
                        plantSort={plantSort}
                        width={60}
                        height={60}
                    />
                    <Row
                        spacing={2}
                        alignItems="center"
                        justifyContent="space-between"
                        className="w-full"
                    >
                        <Typography
                            level="h4"
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
                            <span className="hidden sm:inline">Detalji</span>
                        </Link>
                    </Row>
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
                            <Row spacing={1}>
                                <Sprout className="size-4 shrink-0" />
                                <Typography>Biljka</Typography>
                            </Row>
                        </TabsTrigger>
                        <TabsTrigger value="diary">
                            <Row spacing={1}>
                                <Book className="size-4 shrink-0" />
                                <Typography>Dnevnik</Typography>
                            </Row>
                        </TabsTrigger>
                        {!isHistorical && (
                            <TabsTrigger value="operations">
                                <Row spacing={1}>
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
                            <Card>
                                <CardOverflow className="overflow-auto max-h-96">
                                    <RaisedBedFieldDiary
                                        gardenId={garden.id}
                                        raisedBedId={raisedBed.id}
                                        positionIndex={positionIndex}
                                        disableActions={isHistorical}
                                    />
                                </CardOverflow>
                            </Card>
                        )}
                    </TabsContent>
                    <TabsContent value="lifecycle">
                        <RaisedBedFieldLifecycleTab
                            raisedBedId={raisedBedId}
                            positionIndex={positionIndex}
                            fieldOverride={fieldOverride}
                            includeInactive={isHistorical}
                            onShowOperations={() => setActiveTab('operations')}
                        />
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
        </Modal>
    );
}
