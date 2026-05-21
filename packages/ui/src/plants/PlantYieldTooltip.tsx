import { calculatePlantsPerField } from '@gredice/js/plants';
import type { PropsWithChildren } from 'react';
import { Divider } from '../Divider';
import { Info } from '../icons';
import { Row } from '../Row';
import { Stack } from '../Stack';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { Typography } from '../Typography';

export function PlantYieldTooltip({
    plant,
    children,
}: PropsWithChildren<{
    plant: {
        information: { name: string };
        attributes?: {
            seedingDistance?: number;
            yieldMin?: number;
            yieldMax?: number;
            yieldType?: string;
        };
    };
}>) {
    if (!plant.attributes) {
        return null;
    }

    const { totalPlants } = calculatePlantsPerField(
        plant.attributes.seedingDistance,
    );

    const yieldMin = plant.attributes.yieldMin ?? 0;
    const yieldMax = plant.attributes.yieldMax ?? 0;
    const yieldType = plant.attributes.yieldType ?? 'perField';
    const expectedYieldAverage = (yieldMax - yieldMin) / 2 + yieldMin;
    const minYieldPerField =
        yieldType === 'perField' ? yieldMin : yieldMin * totalPlants;
    const maxYieldPerField =
        yieldType === 'perField' ? yieldMax : yieldMax * totalPlants;
    const expectedYieldPerField =
        yieldType === 'perField'
            ? expectedYieldAverage
            : expectedYieldAverage * totalPlants;

    return (
        <Tooltip>
            <TooltipTrigger className="cursor-pointer">
                <Row>
                    {children} ~{(expectedYieldPerField / 1000).toFixed(1)} kg
                    <Info className="hidden sm:block size-3 shrink-0 ml-1 mt-0.5" />
                </Row>
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-sm">
                    <Stack spacing={1} alignItems="center">
                        <Typography level="body2" bold>
                            Očekivani prinos
                        </Typography>
                        <Divider className="w-20" />
                        <Stack spacing={1} alignItems="center">
                            <span>
                                ~
                                <strong>
                                    {(expectedYieldPerField / 1000).toFixed(1)}
                                </strong>{' '}
                                kg ({totalPlants}{' '}
                                {totalPlants > 1
                                    ? totalPlants > 4
                                        ? 'biljaka'
                                        : 'biljke'
                                    : 'biljka'}
                                )
                            </span>
                            <Stack alignItems="center">
                                {yieldType === 'perPlant' && (
                                    <Row spacing={1}>
                                        <Typography level="body3">
                                            <strong>{yieldMin}</strong> g
                                        </Typography>
                                        {' - '}
                                        <Typography level="body3">
                                            <strong>{yieldMax}</strong> g po
                                            biljci
                                        </Typography>
                                    </Row>
                                )}
                                <Row spacing={1}>
                                    <Typography level="body3">
                                        <strong>{minYieldPerField}</strong> g
                                    </Typography>
                                    {' - '}
                                    <Typography level="body3">
                                        <strong>{maxYieldPerField}</strong> g po
                                        polju
                                    </Typography>
                                </Row>
                            </Stack>
                        </Stack>
                    </Stack>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}
