'use client';

import type {
    getEntitiesRaw,
    SelectAttributeDefinition,
} from '@gredice/storage';
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
    const numberOfRequiredAttributes = definitions.filter(
        (d) => d.required,
    ).length;
    const notPopulatedRequiredAttributes = definitions.filter(
        (d) =>
            d.required &&
            !d.defaultValue &&
            !entity.attributes.some(
                (a) =>
                    a.attributeDefinitionId === d.id &&
                    (a.value?.length ?? 0) > 0,
            ),
    );
    const progress =
        numberOfRequiredAttributes > 0
            ? ((numberOfRequiredAttributes -
                  notPopulatedRequiredAttributes.length) /
                  numberOfRequiredAttributes) *
              100
            : 100;
    const isComplete = progress >= 99.99;

    return (
        <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
                {isComplete ? (
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
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <Typography
                            level="body2"
                            className="hidden group-hover:inline"
                        >
                            {progress.toFixed(0)}%
                        </Typography>
                    </Row>
                )}
            </TooltipTrigger>
            <TooltipContent className="min-w-60">
                {isComplete && 'Svi obavezni atributi su ispunjeni'}
                {!isComplete && (
                    <Stack spacing={1}>
                        <Typography semiBold>
                            Manjak obaveznih atributa ({progress.toFixed(0)}%):
                        </Typography>
                        <Stack>
                            {notPopulatedRequiredAttributes
                                .slice(0, 5)
                                .map((a) => (
                                    <Typography key={a.id}>
                                        {a.label}
                                    </Typography>
                                ))}
                            {notPopulatedRequiredAttributes.length > 5 && (
                                <Typography secondary>
                                    i{' '}
                                    {notPopulatedRequiredAttributes.length - 5}{' '}
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
