import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Hammer, Sprout, Warning } from '@signalco/ui-icons';
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
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import {
    RaisedBedFieldLifecycleTab,
    useRaisedBedFieldLifecycleData,
} from './RaisedBedFieldLifecycleTab';
import { RaisedBedFieldOperationsTab } from './RaisedBedFieldOperationsTab';

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

    const isLoading =
        isGardenLoading || (Boolean(plantSortId) && isPlantSortLoading);
    if (isLoading) {
        return <RaisedBedFieldItemButton isLoading={true} />;
    }

    if (!plantSort) {
        return (
            <RaisedBedFieldItemButton>
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
              },
              {
                  value: growthValue,
                  percentage: growthPercentage,
                  color: 'stroke-green-500',
                  trackColor: 'stroke-green-50 dark:stroke-green-50/80',
                  pulse: !field.plantReadyDate,
              },
              {
                  value: harvestValue,
                  percentage: harvestPercentage,
                  color: 'stroke-blue-500',
                  trackColor: 'stroke-blue-50 dark:stroke-blue-50/80',
                  pulse: Boolean(harvestValue),
              },
          ];

    return (
        <Modal
            title={`Biljka "${plantSort.information.name}"`}
            modal={false}
            className="md:border-tertiary md:border-b-4 max-w-xl"
            trigger={
                <RaisedBedFieldItemButton>
                    <SegmentedCircularProgress
                        size={80}
                        strokeWidth={4}
                        segments={segments}
                    >
                        <Image
                            src={`https://www.gredice.com/${plantSort.image?.cover?.url || plantSort.information.plant.image?.cover?.url}`}
                            alt={plantSort.information.name}
                            className="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2"
                            width={60}
                            height={60}
                        />
                    </SegmentedCircularProgress>
                </RaisedBedFieldItemButton>
            }
        >
            <Stack spacing={2}>
                <Row spacing={2}>
                    <Image
                        src={`https://www.gredice.com/${plantSort.image?.cover?.url || plantSort.information.plant.image?.cover?.url}`}
                        alt={plantSort.information.name}
                        width={60}
                        height={60}
                    />
                    <Typography level="h3">
                        {plantSort.information.name}
                    </Typography>
                </Row>
                <Tabs defaultValue="lifecycle" className="flex flex-col gap-2">
                    <TabsList className="border w-fit self-center">
                        <TabsTrigger value="lifecycle">
                            <Row spacing={1}>
                                <Sprout className="size-4 shrink-0" />
                                <Typography>Biljka</Typography>
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
                    <TabsContent value="lifecycle">
                        <RaisedBedFieldLifecycleTab
                            raisedBedId={raisedBedId}
                            positionIndex={positionIndex}
                        />
                    </TabsContent>
                </Tabs>
            </Stack>
        </Modal>
    );
}
