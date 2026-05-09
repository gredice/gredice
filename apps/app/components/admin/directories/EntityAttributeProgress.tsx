'use client';

import type {
    getEntitiesRaw,
    SelectAttributeDefinition,
} from '@gredice/storage';
import { getEntityCompleteness } from '@gredice/storage/entityCompleteness';
import { Check } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@signalco/ui-primitives/Tooltip';
import { Typography } from '@signalco/ui-primitives/Typography';

export function EntityAttributeProgress({
    entity,
    definitions,
}: {
    entity: Awaited<ReturnType<typeof getEntitiesRaw>>[number];
    definitions: SelectAttributeDefinition[];
}) {
    const completeness = getEntityCompleteness(entity, definitions);

    return (
        <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
                {completeness.isComplete ? (
                    <span className="flex size-5 items-center justify-center">
                        <Check className="size-5 text-green-500" aria-hidden />
                        <span className="sr-only">
                            Svi obavezni atributi su ispunjeni
                        </span>
                    </span>
                ) : (
                    <Row spacing={1} className="group items-center">
                        <div className="h-1 bg-primary/10 rounded-full overflow-hidden grow">
                            <div
                                className="h-full bg-red-400"
                                style={{
                                    width: `${completeness.progress}%`,
                                }}
                            />
                        </div>
                        <Typography
                            level="body2"
                            className="hidden group-hover:inline"
                        >
                            {completeness.progress.toFixed(0)}%
                        </Typography>
                    </Row>
                )}
            </TooltipTrigger>
            <TooltipContent className="min-w-60">
                {completeness.isComplete &&
                    'Svi obavezni atributi su ispunjeni'}
                {!completeness.isComplete && (
                    <Stack spacing={1}>
                        <Typography semiBold>
                            {`Manjak obaveznih atributa (${completeness.progress.toFixed(0)}%):`}
                        </Typography>
                        <Stack>
                            {completeness.missingRequiredDefinitions
                                .slice(0, 5)
                                .map((a) => (
                                    <Typography key={a.id}>
                                        {a.label}
                                    </Typography>
                                ))}
                            {completeness.missingRequiredDefinitions.length >
                                5 && (
                                <Typography secondary>
                                    i{' '}
                                    {completeness.missingRequiredDefinitions
                                        .length - 5}{' '}
                                    drugih...
                                </Typography>
                            )}
                        </Stack>
                    </Stack>
                )}
            </TooltipContent>
        </Tooltip>
    );
}
