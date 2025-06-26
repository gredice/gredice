import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
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

    const plantsPerRow = Math.floor(30 / (plant.attributes.seedingDistance ?? 30));
    if (plantsPerRow < 1) {
        console.warn(`Plants per row is less than 1 (${plantsPerRow}) for ${plant.information.name}. Setting to 1.`);
        return null;
    }

    const yieldMin = plant.attributes.yieldMin ?? 0;
    const yieldMax = plant.attributes.yieldMax ?? 0;
    const yieldType = plant.attributes.yieldType ?? 'perPlant';
    const totalPlants = Math.floor(plantsPerRow * plantsPerRow);
    const expectedYieldAverage = (yieldMax - yieldMin) / 2 + yieldMin;
    const expectedYieldPerField = yieldType === 'perField' ? expectedYieldAverage : expectedYieldAverage * totalPlants;

    return (
        <Tooltip>
            <TooltipTrigger className='cursor-pointer'>
                {children}
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-sm">
                    <Row spacing={2}>
                        <span>Očekivani prinos</span>
                        <Stack alignItems='center'>
                            <span>~<strong>{(expectedYieldPerField / 1000).toFixed(1)}</strong> kg</span>
                            <Row spacing={1}>
                                <Typography level="body3"><strong>{yieldMin}</strong> g</Typography>
                                {' - '}
                                <Typography level="body3"><strong>{yieldMax}</strong> g</Typography>
                            </Row>
                        </Stack>
                    </Row>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}