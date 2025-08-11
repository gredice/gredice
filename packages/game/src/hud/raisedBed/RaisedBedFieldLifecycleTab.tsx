import { SegmentedCircularProgress } from "@gredice/ui/SegmentedCircularProgress";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ReactNode } from "react";
import { usePlantSort } from "../../hooks/usePlantSorts";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Button } from "@signalco/ui-primitives/Button";
import { ShovelIcon } from "../../icons/Shovel";
import { useRaisedBedFieldRemove } from "../../hooks/useRaisedBedFieldRemove";

// TODO: Move to a separate file
export function useRaisedBedFieldLifecycleData(raisedBedId: number, positionIndex: number) {
    const result = {
        germinationValue: 0,
        germinationPercentage: 0,
        germinatingDays: 0,
        growthValue: 0,
        growthPercentage: 0,
        growingDays: 0,
        harvestValue: 0,
        harvestPercentage: 0,
        readyDays: 0,
    };
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const field = raisedBed?.fields.find(field => field.positionIndex === positionIndex && field.active);
    const plantSortId = field?.plantSortId;
    const { data: plantSort } = usePlantSort(plantSortId);
    if (!raisedBed || !field || !plantSort) {
        return result;
    }

    const targetDateNow = (field.stoppedDate ? new Date(field.stoppedDate) : new Date()).getTime();

    const maxDuration =
        (plantSort.information.plant.attributes?.germinationWindowMax ?? 0) +
        (plantSort.information.plant.attributes?.growthWindowMax ?? 0) +
        (plantSort.information.plant.attributes?.harvestWindowMax ?? 0);
    result.germinationPercentage = plantSort.information.plant.attributes?.germinationWindowMax
        ? Math.max(10, Math.min(100, plantSort.information.plant.attributes.germinationWindowMax / (maxDuration ?? 0) * 100))
        : 0;
    result.harvestPercentage = plantSort.information.plant.attributes?.harvestWindowMax
        ? Math.min(100, plantSort.information.plant.attributes.harvestWindowMax / (maxDuration ?? 0) * 100)
        : 0;
    const germinationWindowMs = (plantSort.information.plant.attributes?.germinationWindowMax ?? 0) * 24 * 60 * 60 * 1000;
    result.germinationValue = field.plantGrowthDate
        ? 100
        : (field.plantSowDate
            ? Math.min(100, ((targetDateNow - new Date(field.plantSowDate).getTime())) / (germinationWindowMs || 1) * 100)
            : 0);
    result.germinatingDays = Math.round(((field.plantGrowthDate
        ? new Date(field.plantGrowthDate).getTime()
        : targetDateNow) - (field.plantSowDate
            ? new Date(field.plantSowDate).getTime()
            : targetDateNow)) / (1000 * 60 * 60 * 24));

    result.growthPercentage = 100 - result.germinationPercentage - result.harvestPercentage;
    const growthWindowMs = (plantSort.information.plant.attributes?.growthWindowMax ?? 0) * 24 * 60 * 60 * 1000;
    result.growthValue = field.plantReadyDate ?
        100
        : (field.plantGrowthDate
            ? Math.min(100, (targetDateNow - new Date(field.plantGrowthDate).getTime()) / (growthWindowMs || 1) * 100)
            : 0);
    result.growingDays = Math.round(((field.plantReadyDate
        ? new Date(field.plantReadyDate).getTime()
        : targetDateNow) - (field.plantGrowthDate
            ? new Date(field.plantGrowthDate).getTime()
            : targetDateNow)) / (1000 * 60 * 60 * 24));

    result.harvestValue = field.plantReadyDate
        ? Math.min(100, (targetDateNow - new Date(field.plantReadyDate).getTime()) / (plantSort.information.plant.attributes?.harvestWindowMax ?? 1) * 100)
        : 0;
    result.readyDays = Math.round(((targetDateNow - (field.plantReadyDate
        ? new Date(field.plantReadyDate).getTime()
        : targetDateNow)) / (1000 * 60 * 60 * 24)));

    return result;
}

function useRaisedBedField(raisedBedId: number, positionIndex: number) {
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const field = raisedBed.fields.find(field => field.positionIndex === positionIndex && field.active);
    if (!field || !field.plantSortId) {
        return null;
    }

    return field;
}

function useRaisedBedFieldPlantSort(raisedBedId: number, positionIndex: number) {
    const field = useRaisedBedField(raisedBedId, positionIndex);
    const plantSortId = field?.plantSortId;
    const { data: plantSort } = usePlantSort(plantSortId);
    if (!plantSort) {
        return null;
    }

    return plantSort;
}

export function RaisedBedFieldLifecycleTab({ raisedBedId, positionIndex }: { raisedBedId: number; positionIndex: number }) {
    const {
        germinationValue,
        germinationPercentage,
        germinatingDays,
        growthValue,
        growthPercentage,
        growingDays,
        harvestValue,
        harvestPercentage,
        readyDays
    } = useRaisedBedFieldLifecycleData(raisedBedId, positionIndex);
    const field = useRaisedBedField(raisedBedId, positionIndex);
    const plantSort = useRaisedBedFieldPlantSort(raisedBedId, positionIndex);
    const removeFieldMutation = useRaisedBedFieldRemove();

    if (!plantSort || !field) {
        return null;
    }

    const handleRemovePlant = async () => {
        if (!field.toBeRemoved) {
            return;
        }

        try {
            await removeFieldMutation.mutateAsync({
                raisedBedId,
                positionIndex
            });
        } catch (error) {
            console.error('Failed to remove plant:', error);
            // TODO: Show error message to user
        }
    };

    const plantScheduledDate = field.plantScheduledDate
        ? new Date(field.plantScheduledDate)
        : null;

    let icon: ReactNode | null = null;
    let localizedStatus = field.plantStatus;
    switch (localizedStatus) {
        case 'new':
            icon = <span className="mr-0.5">{'🌟'}</span>;
            localizedStatus = 'Čeka sijanje';
            break;
        case 'planned':
            icon = <span className="mr-0.5">{'⌛'}</span>;
            localizedStatus = 'Planirana';
            break;
        case 'sowed':
            icon = <span className="mr-0.5">{'𓇢'}</span>;
            localizedStatus = 'Posijana';
            break;
        case 'notSprouted':
            icon = <span className="mr-0.5">{'😢'}</span>;
            localizedStatus = 'Nije proklijala';
            break;
        case 'sprouted':
            icon = <span className="mr-0.5">{'🌱'}</span>;
            localizedStatus = 'Proklijala';
            break;
        case 'ready':
            icon = <span className="mr-0.5">{'🌿'}</span>;
            localizedStatus = 'Spremna za berbu';
            break;
        case 'harvested':
            icon = <span className="mr-0.5">{'✅'}</span>;
            localizedStatus = 'Ubrana';
            break;
        case 'died':
            icon = <span className="mr-0.5">{'😢'}</span>;
            localizedStatus = 'Neuspjela';
            break;
        case 'uprooted':
            localizedStatus = 'Uklonjena';
            break;
        default:
            localizedStatus = 'Nepoznato';
            break;
    }

    const germinatingDaysDayPlural = germinatingDays === 1 ? 'dan' : 'dana';
    const growingDaysDayPlural = growingDays === 1 ? 'dan' : 'dana';
    const readyDaysDayPlural = readyDays === 1 ? 'dan' : 'dana';

    const segments = field.toBeRemoved ?
        [
            { value: 100, percentage: 100, color: "stroke-red-500", trackColor: "stroke-red-50 dark:stroke-red-50/80" },
        ]
        : [
            { value: germinationValue, percentage: germinationPercentage, color: "stroke-yellow-500", trackColor: "stroke-yellow-200 dark:stroke-yellow-50", pulse: !field.plantGrowthDate },
            { value: growthValue, percentage: growthPercentage, color: "stroke-green-500", trackColor: "stroke-green-200 dark:stroke-green-50", pulse: !field.plantReadyDate },
            { value: harvestValue, percentage: harvestPercentage, color: "stroke-blue-500", trackColor: "stroke-blue-200 dark:stroke-blue-50", pulse: Boolean(harvestValue) },
        ];

    return (
        <Stack spacing={2}>
            {plantScheduledDate && (
                <Row spacing={2}>
                    <Typography level="body2">Planirani datum</Typography>
                    <div className="flex items-start">
                        <Chip>{plantScheduledDate?.toLocaleDateString("hr-HR") || 'Nepoznato'}</Chip>
                    </div>
                </Row>
            )}
            <Row spacing={2}>
                <SegmentedCircularProgress
                    size={140}
                    strokeWidth={3}
                    segments={segments}
                >
                    <Stack alignItems="center" className="border bg-card rounded-full shrink-0 size-[100px] aspect-square shadow flex items-center justify-center">
                        <span className="text-2xl">{icon}</span>
                        <Typography level="body1" className="text-center" semiBold>
                            {localizedStatus}
                        </Typography>
                    </Stack>
                </SegmentedCircularProgress>
                <Stack spacing={1}>
                    <Stack>
                        <Typography level="body2" secondary>Klijanje ({plantSort.information.plant.attributes?.germinationWindowMin}-{plantSort.information.plant.attributes?.germinationWindowMax} dana)</Typography>
                        <div className="grid gap-x-2 items-center grid-cols-[auto_auto_auto] md:grid-cols-[repeat(4,auto)]">
                            <Typography>
                                {field.plantSowDate
                                    ? new Date(field.plantSowDate).toLocaleDateString("hr-HR")
                                    : 'Nije posijano'}
                            </Typography>
                            {field.plantSowDate && (
                                <>
                                    <span>-</span>
                                    <Typography noWrap>
                                        {field.plantGrowthDate
                                            ? new Date(field.plantGrowthDate).toLocaleDateString("hr-HR")
                                            : (field.stoppedDate ? new Date(field.stoppedDate).toLocaleDateString("hr-HR") : 'U tijeku...')}
                                    </Typography>
                                    <Typography>
                                        ({germinatingDays} {germinatingDaysDayPlural})
                                    </Typography>
                                </>
                            )}
                        </div>
                    </Stack>
                    <Stack>
                        <Typography level="body2" secondary>Rast ({plantSort.information.plant.attributes?.growthWindowMin}-{plantSort.information.plant.attributes?.growthWindowMax} dana)</Typography>
                        <div className="grid gap-x-2 items-center grid-cols-[auto_auto_auto] md:grid-cols-[repeat(4,auto)]">
                            <Typography>
                                {field.plantGrowthDate
                                    ? new Date(field.plantGrowthDate).toLocaleDateString("hr-HR")
                                    : 'Nije u fazi rasta'}
                            </Typography>
                            {field.plantGrowthDate && (
                                <>
                                    <span>-</span>
                                    <Typography noWrap>
                                        {field.plantReadyDate
                                            ? new Date(field.plantReadyDate).toLocaleDateString("hr-HR")
                                            : (field.stoppedDate ? new Date(field.stoppedDate).toLocaleDateString("hr-HR") : 'U tijeku...')}
                                    </Typography>
                                    <Typography>
                                        ({growingDays} {growingDaysDayPlural})
                                    </Typography>
                                </>
                            )}
                        </div>
                    </Stack>
                    <Stack>
                        <Typography level="body2" secondary>Berba ({plantSort.information.plant.attributes?.harvestWindowMin}-{plantSort.information.plant.attributes?.harvestWindowMax} dana)</Typography>
                        <Row spacing={0.5}>
                            <Typography>
                                {field.plantReadyDate
                                    ? new Date(field.plantReadyDate).toLocaleDateString("hr-HR")
                                    : 'Nije u fazi berbe'}
                            </Typography>
                            {field.plantReadyDate && (
                                <Typography>
                                    ({readyDays} {readyDaysDayPlural})
                                </Typography>
                            )}
                        </Row>
                    </Stack>
                </Stack>
            </Row>
            {field.toBeRemoved && (
                <Row>
                    <Button
                        variant="solid"
                        fullWidth
                        loading={removeFieldMutation.isPending}
                        disabled={removeFieldMutation.isPending}
                        onClick={handleRemovePlant}
                        startDecorator={<ShovelIcon className="size-5 shrink-0" />}>
                        Ukloni biljku
                    </Button>
                </Row>
            )}
        </Stack>
    )
}