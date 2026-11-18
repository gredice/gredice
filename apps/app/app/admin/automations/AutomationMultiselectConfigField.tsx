'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Typography } from '@gredice/ui/Typography';
import { useId } from 'react';
import { AutomationConfigFieldDescription } from './AutomationConfigFieldDescription';
import {
    type AutomationConfigFieldProps,
    multiselectFieldValue,
    toggleMultiselectFieldValue,
} from './automationConfigFieldValues';
import {
    automationConfigFieldDescription,
    automationConfigFieldLabel,
    automationConfigFieldOptionLabel,
} from './presentation';

export function AutomationMultiselectConfigField({
    field,
    module,
    onChange,
    value,
}: AutomationConfigFieldProps) {
    const id = useId();
    const options = field.options ?? [];
    const { selected, unknown } = multiselectFieldValue(value, options);
    const description = automationConfigFieldDescription(module, field);
    const descriptionId = description ? `${id}-description` : undefined;

    function toggle(optionValue: string, checked: boolean) {
        onChange(
            toggleMultiselectFieldValue({
                checked,
                options,
                optionValue,
                selected,
            }),
        );
    }

    return (
        <fieldset className="space-y-2" aria-describedby={descriptionId}>
            <legend className="mb-2 text-sm font-medium">
                {automationConfigFieldLabel(module, field)}
            </legend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {options.map((option) => (
                    <Checkbox
                        key={option.value}
                        id={`${id}-${option.value}`}
                        label={automationConfigFieldOptionLabel({
                            field,
                            module,
                            option,
                        })}
                        checked={selected.includes(option.value)}
                        onCheckedChange={(checked) =>
                            toggle(option.value, checked === true)
                        }
                    />
                ))}
            </div>
            {unknown.length > 0 ? (
                <Typography
                    level="body3"
                    className="text-amber-700 dark:text-amber-300"
                >
                    Nepoznate vrijednosti ({unknown.join(', ')}) uklonit će se
                    pri sljedećoj promjeni.
                </Typography>
            ) : null}
            <AutomationConfigFieldDescription id={descriptionId}>
                {description}
            </AutomationConfigFieldDescription>
        </fieldset>
    );
}
