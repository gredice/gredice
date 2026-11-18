'use client';

import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { useMemo } from 'react';
import { AutomationConfigFieldDescription } from './AutomationConfigFieldDescription';
import {
    type AutomationConfigFieldProps,
    optionalStringFieldValue,
    stringFieldValue,
    supportedTimeZones,
    timeZoneFieldOptions,
} from './automationConfigFieldValues';
import {
    automationConfigFieldDescription,
    automationConfigFieldLabel,
    automationConfigFieldPlaceholder,
} from './presentation';

export function AutomationTimeZoneConfigField({
    field,
    module,
    onChange,
    value,
}: AutomationConfigFieldProps) {
    const timeZone = stringFieldValue(value);
    const placeholder = automationConfigFieldPlaceholder(module, field);
    const items = useMemo(
        () => [
            ...(field.required
                ? []
                : [
                      {
                          value: '',
                          label: placeholder
                              ? `Zadano (${placeholder})`
                              : 'Zadano',
                      },
                  ]),
            ...timeZoneFieldOptions(timeZone, supportedTimeZones()).map(
                (candidate) => ({ value: candidate, label: candidate }),
            ),
        ],
        [field.required, placeholder, timeZone],
    );

    return (
        <Stack spacing={1}>
            <SelectItems
                className="w-full"
                label={automationConfigFieldLabel(module, field)}
                value={timeZone}
                items={items}
                placeholder={placeholder}
                searchPlaceholder="Pretraži vremenske zone"
                onValueChange={(nextValue) =>
                    onChange(optionalStringFieldValue(nextValue))
                }
            />
            <AutomationConfigFieldDescription>
                {automationConfigFieldDescription(module, field)}
            </AutomationConfigFieldDescription>
        </Stack>
    );
}
