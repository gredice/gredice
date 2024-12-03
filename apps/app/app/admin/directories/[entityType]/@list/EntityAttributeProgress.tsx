import { getAttributeDefinitions, getEntitiesRaw } from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Tooltip, TooltipContent, TooltipTrigger } from '@signalco/ui-primitives/Tooltip';
import { Typography } from '@signalco/ui-primitives/Typography';
import { cx } from '@signalco/ui-primitives/cx'
import { cache } from 'react';

const definitionsCache = cache(getAttributeDefinitions);

export async function EntityAttributeProgress({ entityTypeName, entity }: { entityTypeName: string, entity: Awaited<ReturnType<typeof getEntitiesRaw>>[0] }) {
    const definitions = await definitionsCache(entityTypeName);
    const numberOfRequiredAttributes = definitions.filter(d => d.required).length;
    const notPopulatedRequiredAttributes = definitions.filter(d =>
        d.required &&
        !entity.attributes.some(a => a.attributeDefinitionId === d.id && (a.value?.length ?? 0) > 0));
    const progress = ((numberOfRequiredAttributes - notPopulatedRequiredAttributes.length) / numberOfRequiredAttributes) * 100;

    return (
        <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
                <div className='h-1 bg-primary/10 rounded-full overflow-hidden'>
                    <div
                        className={cx('h-full', progress <= 99.99 ? 'bg-red-400' : 'bg-green-500')}
                        style={{ width: `${progress}%` }} />
                </div>
            </TooltipTrigger>
            <TooltipContent className='min-w-60'>
                {notPopulatedRequiredAttributes.length === 0
                    && 'Svi obavezni atributi su ispunjeni'}
                {notPopulatedRequiredAttributes.length > 0 && (
                    <Stack spacing={1}>
                        <Typography semiBold>Manjak obaveznih atributa:</Typography>
                        <Stack>
                            {notPopulatedRequiredAttributes.slice(0, 5).map(a => (
                                <Typography key={a.id}>{a.label}</Typography>
                            ))}
                            {notPopulatedRequiredAttributes.length > 5
                                && <Typography secondary>i {notPopulatedRequiredAttributes.length - 5} drugih...</Typography>}
                        </Stack>
                    </Stack>
                )}
            </TooltipContent>
        </Tooltip>
    );
}