import type { PlantData } from '@gredice/client';
import {
    ArrowDownToLine,
    Droplet,
    Leaf,
    Ruler,
    ShoppingCart,
    Sprout,
    Store,
    Sun,
    SunMoon,
    Tally3,
    Thermometer,
    Timer,
} from '@signalco/ui-icons';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AttributeCard } from '../../../components/attributes/DetailCard';

export function PlantAttributeCards({
    attributes,
}: {
    attributes: PlantData['attributes'] | undefined;
}) {
    const formatDayRange = (
        min?: number | null,
        max?: number | null,
    ): string => {
        if (min == null && max == null) {
            return '-';
        }
        if (min != null && max != null) {
            if (min === max) {
                return `${min} ${min === 1 ? 'dan' : 'dana'}`;
            }
            return `${min}-${max} dana`;
        }
        const value = min ?? max;
        return value == null ? '-' : `${value} ${value === 1 ? 'dan' : 'dana'}`;
    };

    const formatWeightRange = (
        min?: number | null,
        max?: number | null,
    ): string | undefined => {
        if (min == null && max == null) {
            return undefined;
        }
        if (min != null && max != null) {
            if (min === max) {
                return `${min} g`;
            }
            return `${min}-${max} g`;
        }
        const value = min ?? max;
        return value == null ? undefined : `${value} g`;
    };

    const getPlantsLabel = (count: number) => {
        if (count === 1) {
            return 'biljku';
        }
        if (count > 4) {
            return 'biljaka';
        }
        return 'biljke';
    };

    const getYieldDetails = () => {
        if (!attributes) {
            return null;
        }

        const seedingDistance = attributes.seedingDistance ?? 30;
        const plantsPerRow = Math.max(1, Math.floor(30 / seedingDistance));
        const totalPlants = Math.max(
            1,
            Math.floor(plantsPerRow * plantsPerRow),
        );

        const yieldMin = attributes.yieldMin ?? null;
        const yieldMax = attributes.yieldMax ?? null;
        if (yieldMin == null && yieldMax == null) {
            return null;
        }

        const yieldType = attributes.yieldType ?? 'perField';
        const yieldMultiplier = yieldType === 'perPlant' ? totalPlants : 1;

        const minValue = yieldMin ?? yieldMax;
        const maxValue = yieldMax ?? yieldMin;

        const expectedBase =
            minValue != null && maxValue != null
                ? (maxValue - minValue) / 2 + minValue
                : (minValue ?? maxValue);

        const expectedPerField =
            expectedBase == null ? null : expectedBase * yieldMultiplier;

        const perFieldMin =
            minValue == null ? null : minValue * yieldMultiplier;
        const perFieldMax =
            maxValue == null ? null : maxValue * yieldMultiplier;

        const perFieldRange = formatWeightRange(perFieldMin, perFieldMax);
        const perPlantRange =
            yieldType === 'perPlant'
                ? formatWeightRange(yieldMin, yieldMax)
                : undefined;

        return {
            expectedPerFieldKg:
                expectedPerField == null
                    ? undefined
                    : (expectedPerField / 1000).toFixed(1),
            perFieldRange: perFieldRange
                ? `${perFieldRange} po polju`
                : undefined,
            perPlantRange: perPlantRange
                ? `${perPlantRange} po biljci`
                : undefined,
            plantsDescription: `Preračunato za ${totalPlants} ${getPlantsLabel(totalPlants)}`,
        };
    };

    const yieldDetails = getYieldDetails();

    return (
        <div className="grid grid-cols-2 gap-2">
            <AttributeCard
                icon={<Sun />}
                header="Svijetlost"
                value={
                    attributes?.light == null || Number.isNaN(attributes?.light)
                        ? '-'
                        : attributes.light >= 0.7
                          ? 'Sunce'
                          : attributes.light >= 0.3
                            ? 'Polu-sjena'
                            : 'Hlad'
                }
            />
            <AttributeCard
                icon={<Droplet />}
                header="Voda"
                value={attributes?.water ?? '-'}
            />
            <AttributeCard
                icon={<Tally3 className="size-6 rotate-90 mt-2" />}
                header="Zemlja"
                value={attributes?.soil ?? '-'}
            />
            <AttributeCard
                icon={<Leaf />}
                header="Nutrijenti"
                value={attributes?.nutrients ?? '-'}
            />
            <AttributeCard
                icon={<Ruler />}
                header="Razmak sijanja/sadnje"
                value={`${
                    attributes?.seedingDistance != null
                        ? attributes.seedingDistance
                        : '-'
                } cm`}
            />
            <AttributeCard
                icon={<ArrowDownToLine />}
                header="Dubina sijanja"
                value={`${
                    attributes?.seedingDepth != null
                        ? attributes.seedingDepth
                        : '-'
                } cm`}
            />
            <AttributeCard
                icon={<Sprout />}
                header="Klijanje"
                value={attributes?.germinationType ?? '-'}
            />
            <AttributeCard
                icon={<Thermometer />}
                header="Temperatura klijanja"
                value={`${attributes?.gernimationTemperature ?? '-'}°C`}
            />
            <AttributeCard
                icon={<Timer />}
                header="Vrijeme klijanja"
                value={formatDayRange(
                    attributes?.germinationWindowMin,
                    attributes?.germinationWindowMax,
                )}
            />
            <AttributeCard
                icon={<SunMoon />}
                header="Vrijeme rasta"
                value={formatDayRange(
                    attributes?.growthWindowMin,
                    attributes?.growthWindowMax,
                )}
            />
            <AttributeCard
                icon={<Store />}
                header="Vrijeme berbe"
                value={formatDayRange(
                    attributes?.harvestWindowMin,
                    attributes?.harvestWindowMax,
                )}
            />
            <AttributeCard
                icon={<ShoppingCart />}
                header="Očekivani prinos"
                value={
                    yieldDetails ? (
                        <Stack spacing={0.5}>
                            <Typography semiBold>
                                {yieldDetails.expectedPerFieldKg
                                    ? `~${yieldDetails.expectedPerFieldKg} kg po polju`
                                    : '-'}
                            </Typography>
                            {yieldDetails.perFieldRange && (
                                <Typography level="body3">
                                    {yieldDetails.perFieldRange}
                                </Typography>
                            )}
                            {yieldDetails.perPlantRange && (
                                <Typography level="body3">
                                    {yieldDetails.perPlantRange}
                                </Typography>
                            )}
                            <Typography level="body3">
                                {yieldDetails.plantsDescription}
                            </Typography>
                        </Stack>
                    ) : undefined
                }
            />
        </div>
    );
}
