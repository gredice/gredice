'use client';

import { Button } from '@gredice/ui/Button';
import { CalendarDatePicker } from '@gredice/ui/CalendarDatePicker';
import {
    type AutomationConfigFieldProps,
    stringFieldValue,
} from './automationConfigFieldValues';
import {
    automationConfigFieldDescription,
    automationConfigFieldLabel,
} from './presentation';

export function AutomationDateConfigField({
    field,
    module,
    onChange,
    value,
}: AutomationConfigFieldProps) {
    const date = stringFieldValue(value);

    return (
        <CalendarDatePicker
            label={automationConfigFieldLabel(module, field)}
            helperText={automationConfigFieldDescription(module, field)}
            value={date}
            onValueChange={onChange}
            required={field.required}
            fullWidth
        >
            {date && !field.required ? (
                <Button
                    type="button"
                    size="sm"
                    variant="plain"
                    fullWidth
                    onClick={() => onChange(undefined)}
                >
                    Očisti datum
                </Button>
            ) : null}
        </CalendarDatePicker>
    );
}
