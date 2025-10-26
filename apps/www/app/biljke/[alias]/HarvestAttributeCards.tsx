import type { PlantData } from '@gredice/client';
import { calculatePlantsPerField } from '@gredice/js/plants';
import { ShoppingCart, Store } from '@signalco/ui-icons';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AttributeCard } from '../../../components/attributes/DetailCard';

export function HarvestAttributeCards({
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

    const getYieldDetails = () => {
        if (!attributes) {
            return null;
        }

        const { totalPlants } = calculatePlantsPerField(
            attributes.seedingDistance,
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
                ? (minValue + maxValue) / 2
                : (minValue ?? maxValue);

        const expectedPerField =
            expectedBase == null ? null : expectedBase * yieldMultiplier;

        const perFieldMin =
            minValue == null ? null : minValue * yieldMultiplier;
        const perFieldMax =
            maxValue == null ? null : maxValue * yieldMultiplier;

        const perFieldRange = formatWeightRange(perFieldMin, perFieldMax);
        return {
            expectedPerFieldKg:
                expectedPerField == null
                    ? undefined
                    : (expectedPerField / 1000).toFixed(1),
            perFieldRange: perFieldRange
                ? `${perFieldRange} po polju`
                : undefined,
        };
    };

    const yieldDetails = getYieldDetails();

    return (
        <div className="grid grid-cols-2 gap-2">
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
                        </Stack>
                    ) : undefined
                }
            />
        </div>
    );
}
