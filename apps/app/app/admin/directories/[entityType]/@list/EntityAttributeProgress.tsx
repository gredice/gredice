import { getAttributeDefinitions, getEntitiesRaw } from '@gredice/storage';
import { Tooltip, TooltipContent, TooltipTrigger } from '@signalco/ui-primitives/Tooltip';
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
            <TooltipTrigger>
                <div className='py-2 px-1'>
                    <div className='h-1 bg-gray-200 rounded-full overflow-hidden w-14'>
                        <div
                            className={cx('h-full', progress <= 99.99 ? 'bg-red-400' : 'bg-green-500')}
                            style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                {notPopulatedRequiredAttributes.length === 0
                    ? 'Svi obavezni atributi su ispunjeni'
                    : `Manjak obaveznih atributa: ${notPopulatedRequiredAttributes.map(a => a.label).join(', ')}`}
            </TooltipContent>
        </Tooltip>
    );
}