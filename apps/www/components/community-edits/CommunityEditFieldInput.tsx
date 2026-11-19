import { Input } from '@gredice/ui/Input';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import dynamic from 'next/dynamic';
import {
    inputControlClassName,
    selectControlClassName,
    textareaControlClassName,
} from './communityControlStyles';
import {
    type CommunityEditableField,
    type FieldValue,
    isFieldEditableHere,
    isRangeFieldValue,
    referenceListFromText,
    referencePickerNoun,
} from './communityEditFields';
import { OperationSuggestionInput } from './OperationSuggestionInput';
import { PlantReferencePicker } from './PlantReferencePicker';

const CommunityMarkdownInput = dynamic(
    () =>
        import('./CommunityMarkdownInput').then(
            (module) => module.CommunityMarkdownInput,
        ),
    {
        ssr: false,
    },
);

export function CommunityEditFieldInput({
    errorId,
    field,
    id,
    invalid,
    onChange,
    value,
}: {
    errorId?: string;
    field: CommunityEditableField;
    id: string;
    invalid?: boolean;
    onChange: (value: FieldValue) => void;
    value: FieldValue;
}) {
    if (!isFieldEditableHere(field)) {
        return (
            <Typography
                className="rounded-md border border-dashed border-border/80 bg-card p-3 text-muted-foreground"
                id={id}
                level="body3"
            >
                Ovo polje trenutno nije moguće uređivati ovdje.
            </Typography>
        );
    }

    if (field.controlType === 'operationSuggestion') {
        return (
            <OperationSuggestionInput
                field={field}
                id={id}
                onChange={onChange}
                value={value}
            />
        );
    }

    if (field.controlType === 'markdown') {
        return (
            <CommunityMarkdownInput
                id={id}
                onChange={onChange}
                value={typeof value === 'string' ? value : ''}
            />
        );
    }

    if (field.controlType === 'boolean') {
        return (
            <select
                className={selectControlClassName}
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                value={typeof value === 'string' ? value : ''}
            >
                <option value="">Nije određeno</option>
                <option value="true">Da</option>
                <option value="false">Ne</option>
            </select>
        );
    }

    if (field.controlType === 'select') {
        return (
            <select
                className={selectControlClassName}
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                value={typeof value === 'string' ? value : ''}
            >
                <option value="">Nije određeno</option>
                {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    }

    if (field.controlType === 'reference') {
        return (
            <PlantReferencePicker
                id={id}
                label={field.publicLabel}
                noun={referencePickerNoun(field.dataType)}
                onValueChange={(values) => onChange(values.join('\n'))}
                options={field.options ?? []}
                selectedValues={referenceListFromText(
                    typeof value === 'string' ? value : '',
                )}
            />
        );
    }

    if (field.controlType === 'number') {
        return (
            <Input
                className={inputControlClassName}
                fullWidth
                id={id}
                inputMode="decimal"
                onChange={(event) => onChange(event.currentTarget.value)}
                type="number"
                value={typeof value === 'string' ? value : ''}
            />
        );
    }

    if (field.controlType === 'range') {
        const rangeValue = isRangeFieldValue(value)
            ? value
            : {
                  min: '',
                  max: '',
              };
        return (
            <div className="grid gap-2 sm:grid-cols-2">
                <Input
                    aria-describedby={invalid ? errorId : undefined}
                    aria-invalid={invalid || undefined}
                    className={inputControlClassName}
                    fullWidth
                    id={`${id}-min`}
                    inputMode="decimal"
                    label="Najmanje"
                    onChange={(event) =>
                        onChange({
                            ...rangeValue,
                            min: event.currentTarget.value,
                        })
                    }
                    type="number"
                    value={rangeValue.min}
                />
                <Input
                    aria-describedby={invalid ? errorId : undefined}
                    aria-invalid={invalid || undefined}
                    className={inputControlClassName}
                    fullWidth
                    id={`${id}-max`}
                    inputMode="decimal"
                    label="Najviše"
                    onChange={(event) =>
                        onChange({
                            ...rangeValue,
                            max: event.currentTarget.value,
                        })
                    }
                    type="number"
                    value={rangeValue.max}
                />
            </div>
        );
    }

    return (
        <textarea
            className={cx(textareaControlClassName, 'min-h-24')}
            id={id}
            onChange={(event) => onChange(event.currentTarget.value)}
            value={typeof value === 'string' ? value : ''}
        />
    );
}
