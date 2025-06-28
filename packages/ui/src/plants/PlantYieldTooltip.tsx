import { Divider } from '@signalco/ui-primitives/Divider';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Info } from '@signalco/ui-icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@signalco/ui-primitives/Tooltip';
import { Typography } from '@signalco/ui-primitives/Typography';
import { PropsWithChildren } from 'react';

export function PlantYieldTooltip({ plant, children }: PropsWithChildren<{
    plant: {
        information: { name: string };
        attributes?: {
            seedingDistance?: number;
            yieldMin?: number;
            yieldMax?: number;
            yieldType?: string;
        };
    }
}>) {
    if (!plant.attributes) {
        return null;
    }

    let plantsPerRow = Math.floor(30 / (plant.attributes.seedingDistance ?? 30));
    if (plantsPerRow < 1) {
        console.warn(`Plants per row is less than 1 (${plantsPerRow}) for ${plant.information.name}. Setting to 1.`);
        plantsPerRow = 1;
    }

    const yieldMin = plant.attributes.yieldMin ?? 0;
    const yieldMax = plant.attributes.yieldMax ?? 0;
    const yieldType = plant.attributes.yieldType ?? 'perField';
    const totalPlants = Math.floor(plantsPerRow * plantsPerRow);
    const expectedYieldAverage = (yieldMax - yieldMin) / 2 + yieldMin;
    const minYieldPerField = yieldType === 'perField' ? yieldMin : yieldMin * totalPlants;
    const maxYieldPerField = yieldType === 'perField' ? yieldMax : yieldMax * totalPlants;
    const expectedYieldPerField = yieldType === 'perField' ? expectedYieldAverage : expectedYieldAverage * totalPlants;

    console.log('tooltip', plant.information.name, expectedYieldPerField, yieldMax, yieldMin, yieldType, totalPlants);

    return (
        <Tooltip>
            <TooltipTrigger className='cursor-pointer'>
                <Row>
                    {children}
                    <Info className='size-3 shrink-0 ml-1 mt-0.5' />
                </Row>
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-sm">
                    <Stack spacing={1} alignItems='center'>
                        <Typography level="body2" bold>Očekivani prinos</Typography>
                        <Divider className='w-20' />
                        <Stack spacing={1} alignItems='center'>
                            <span>~<strong>{(expectedYieldPerField / 1000).toFixed(1)}</strong> kg ({totalPlants} {totalPlants > 1 ? (totalPlants > 4 ? 'biljaka' : 'biljke') : 'biljka'})</span>
                            <Stack alignItems='center'>
                                {yieldType === 'perPlant' && (
                                    <Row spacing={1}>
                                        <Typography level="body3"><strong>{yieldMin}</strong> g</Typography>
                                        {' - '}
                                        <Typography level="body3"><strong>{yieldMax}</strong> g po biljci</Typography>
                                    </Row>
                                )}
                                <Row spacing={1}>
                                    <Typography level="body3"><strong>{minYieldPerField}</strong> g</Typography>
                                    {' - '}
                                    <Typography level="body3"><strong>{maxYieldPerField}</strong> g po polju</Typography>
                                </Row>
                            </Stack>
                        </Stack>
                    </Stack>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}