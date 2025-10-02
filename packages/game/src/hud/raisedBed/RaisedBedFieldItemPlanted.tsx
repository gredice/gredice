import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { isAbsoluteUrl } from '@signalco/js';
import {
    Book,
    Check,
    ExternalLink,
    Hammer,
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
import Image from 'next/image';
import { useState } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { KnownPages } from '../../knownPages';
import { RaisedBedFieldDiary } from './RaisedBedDiary';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import {
    RaisedBedFieldLifecycleTab,
    useRaisedBedFieldLifecycleData,
} from './RaisedBedFieldLifecycleTab';
import { RaisedBedFieldOperationsTab } from './RaisedBedFieldOperationsTab';

type RaisedBedFieldTabValue = 'lifecycle' | 'diary' | 'operations';

export function RaisedBedFieldItemPlanted({
    raisedBedId,
    positionIndex,
}: {
    raisedBedId: number;
    positionIndex: number;
}) {
    const { data: garden, isLoading: isGardenLoading } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const field = raisedBed?.fields.find(
        (field) => field.positionIndex === positionIndex && field.active,
    );
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
    } = useRaisedBedFieldLifecycleData(raisedBedId, positionIndex);
    const isHarvested = field?.plantHarvestedDate;
    const [activeTab, setActiveTab] =
        useState<RaisedBedFieldTabValue>('lifecycle');

    if (!raisedBed) {
        return null;
    }
    if (!field || !field.plantSortId) {
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
        return (
            <RaisedBedFieldItemButton
                isLoading={true}
                positionIndex={positionIndex}
            />
        );
    }

    // Error state (plant sort unknown)
    if (!plantSort) {
        return (
            <RaisedBedFieldItemButton positionIndex={positionIndex}>
                <Warning className="size-10" />
            </RaisedBedFieldItemButton>
        );
    }

    const segments = field.toBeRemoved
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

    const coverUrl =
        (plantSort.image?.cover?.url ||
            plantSort.information.plant.image?.cover?.url) ??
        '/assets/plants/placeholder.png';
    const plantImageUrl = isAbsoluteUrl(coverUrl)
        ? coverUrl
        : `https://www.gredice.com/${coverUrl}`;

    return (
        <Modal
            title={`Biljka "${plantSort.information.name}"`}
            modal={false}
            className="md:border-tertiary md:border-b-4 max-w-xl"
            trigger={
                <RaisedBedFieldItemButton positionIndex={positionIndex}>
                    <SegmentedCircularProgress
                        size={80}
                        strokeWidth={4}
                        segments={segments}
                    >
                        <Image
                            src={plantImageUrl}
                            alt={plantSort.information.name}
                            className="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2"
                            width={60}
                            height={60}
                        />
                        {harvestValue && !isHarvested && (
                            <div className="absolute -top-1 -end-1">
                                <span className="inline-flex items-center justify-center p-1 bg-blue-600 rounded-full border-2 border-white shadow-lg">
                                    <Sprout className="size-4 text-white" />
                                </span>
                            </div>
                        )}
                        {isHarvested && (
                            <div className="absolute -top-1 -end-1">
                                <span className="inline-flex items-center justify-center p-1 bg-green-600 rounded-full border-2 border-white shadow-lg">
                                    <Check className="size-4 text-white" />
                                </span>
                            </div>
                        )}
                    </SegmentedCircularProgress>
                </RaisedBedFieldItemButton>
            }
        >
            <Stack spacing={2}>
                <Row spacing={2} className="flex-wrap gap-y-2">
                    <Image
                        src={plantImageUrl}
                        alt={plantSort.information.name}
                        width={60}
                        height={60}
                    />
                    <Row spacing={2} alignItems="end">
                        <Typography
                            level="h3"
                            className="truncate"
                            title={plantSort.information.name}
                        >
                            {plantSort.information.name}
                        </Typography>
                        <Link
                            href={plantDetailsUrl}
                            target="_blank"
                            aria-label="Detalji o biljci"
                            className="inline-flex mb-1 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-muted-foreground/60 shrink-0"
                        >
                            <ExternalLink className="size-4" />
                            <span className="hidden sm:inline">Detalji</span>
                        </Link>
                    </Row>
                </Row>
                <Tabs
                    value={activeTab}
                    onValueChange={(value: string) => {
                        setActiveTab(value as RaisedBedFieldTabValue);
                    }}
                    className="flex flex-col gap-2"
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
                        <TabsTrigger value="operations">
                            <Row spacing={1}>
                                <Hammer className="size-4 shrink-0" />
                                <Typography>Radnje</Typography>
                            </Row>
                        </TabsTrigger>
                    </TabsList>
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
                    <TabsContent value="diary">
                        {garden && (
                            <Card>
                                <CardOverflow className="overflow-auto max-h-96">
                                    <RaisedBedFieldDiary
                                        gardenId={garden.id}
                                        raisedBedId={raisedBed.id}
                                        positionIndex={positionIndex}
                                    />
                                </CardOverflow>
                            </Card>
                        )}
                    </TabsContent>
                    <TabsContent value="lifecycle">
                        <RaisedBedFieldLifecycleTab
                            raisedBedId={raisedBedId}
                            positionIndex={positionIndex}
                            onShowOperations={() => setActiveTab('operations')}
                        />
                    </TabsContent>
                </Tabs>
            </Stack>
        </Modal>
    );
}
