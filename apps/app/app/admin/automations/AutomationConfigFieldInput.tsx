'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { AutomationConfigFieldDescription } from './AutomationConfigFieldDescription';
import { AutomationDateConfigField } from './AutomationDateConfigField';
import { AutomationJsonConfigField } from './AutomationJsonConfigField';
import { AutomationMultiselectConfigField } from './AutomationMultiselectConfigField';
import { AutomationTimeZoneConfigField } from './AutomationTimeZoneConfigField';
import {
    type AutomationConfigFieldProps,
    type JsonConfigDraft,
    optionalStringFieldValue,
    stringFieldValue,
} from './automationConfigFieldValues';
import {
    automationConfigFieldDescription,
    automationConfigFieldLabel,
    automationConfigFieldOptionLabel,
    automationConfigFieldPlaceholder,
} from './presentation';

/** Renders the editor control for one module config field by its `type`. */
export function AutomationConfigFieldInput({
    field,
    jsonDraft,
    module,
    onChange,
    onJsonDraftChange,
    value,
}: AutomationConfigFieldProps & {
    jsonDraft: JsonConfigDraft | undefined;
    onJsonDraftChange(draft: JsonConfigDraft | undefined): void;
}) {
    const label = automationConfigFieldLabel(module, field);
    const description = automationConfigFieldDescription(module, field);
    const fieldProps = { field, module, onChange, value };

    switch (field.type) {
        case 'select':
            return (
                <Stack spacing={1}>
                    <SelectItems
                        className="w-full"
                        label={label}
                        value={typeof value === 'string' ? value : ''}
                        items={
                            field.options?.map((option) => ({
                                value: option.value,
                                label: automationConfigFieldOptionLabel({
                                    field,
                                    module,
                                    option,
                                }),
                            })) ?? []
                        }
                        onValueChange={onChange}
                    />
                    <AutomationConfigFieldDescription>
                        {description}
                    </AutomationConfigFieldDescription>
                </Stack>
            );
        case 'multiselect':
            return <AutomationMultiselectConfigField {...fieldProps} />;
        case 'boolean':
            return (
                <Checkbox
                    label={label}
                    checked={value === true}
                    onCheckedChange={(checked) => onChange(checked === true)}
                />
            );
        case 'date':
            return <AutomationDateConfigField {...fieldProps} />;
        case 'time':
        case 'datetime':
            return (
                <Input
                    label={label}
                    helperText={description}
                    type={field.type === 'time' ? 'time' : 'datetime-local'}
                    required={field.required}
                    value={stringFieldValue(value)}
                    onChange={(event) =>
                        onChange(optionalStringFieldValue(event.target.value))
                    }
                    fullWidth
                />
            );
        case 'timeZone':
            return <AutomationTimeZoneConfigField {...fieldProps} />;
        case 'json':
            return (
                <AutomationJsonConfigField
                    description={description}
                    draft={jsonDraft}
                    label={label}
                    onChange={onChange}
                    onDraftChange={onJsonDraftChange}
                    value={value}
                />
            );
        default:
            return (
                <Input
                    label={label}
                    helperText={description}
                    placeholder={automationConfigFieldPlaceholder(
                        module,
                        field,
                    )}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={
                        typeof value === 'string' || typeof value === 'number'
                            ? value
                            : ''
                    }
                    onChange={(event) =>
                        onChange(
                            field.type === 'number'
                                ? event.target.value.trim()
                                    ? Number(event.target.value)
                                    : undefined
                                : event.target.value,
                        )
                    }
                    fullWidth
                />
            );
    }
}
