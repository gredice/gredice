import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useState } from 'react';
import { CommunityEditFieldInput } from './CommunityEditFieldInput';
import { attributeFieldIcon } from './communityEditFieldIcon';
import {
    type CommunityEditableField,
    communityEditFieldGroup,
    type FieldValue,
    fieldChanged,
    fieldInputId,
    fieldValueError,
    initialFieldValue,
    isFieldEditableHere,
} from './communityEditFields';

/** Published value of a short field, shown next to a changed value. */
function publishedValueLabel(field: CommunityEditableField) {
    if (field.controlType === 'number') {
        return field.currentValue ?? 'nije određeno';
    }

    if (field.controlType === 'boolean') {
        if (field.currentValue === 'true') {
            return 'Da';
        }
        return field.currentValue === 'false' ? 'Ne' : 'nije određeno';
    }

    if (field.controlType === 'select') {
        return (
            field.options?.find((option) => option.value === field.currentValue)
                ?.label ?? 'nije određeno'
        );
    }

    return null;
}

export function CommunityEditField({
    field,
    idPrefix,
    onChange,
    value,
}: {
    field: CommunityEditableField;
    idPrefix: string;
    onChange: (value: FieldValue) => void;
    value: FieldValue;
}) {
    // The markdown editor only reads its value when it mounts, so restoring
    // it (or receiving a newer published value) has to mount a fresh input.
    const [restoreCount, setRestoreCount] = useState(0);
    const id = fieldInputId(idPrefix, field);
    const errorId = `${id}-error`;
    const group = communityEditFieldGroup(field);
    const icon = group === 'attributes' ? attributeFieldIcon(field) : null;
    const editable = isFieldEditableHere(field);
    const error = fieldValueError(field, value);
    const changed = fieldChanged(field, value);
    const publishedValue = changed ? publishedValueLabel(field) : null;
    const title = (
        <>
            <Typography level="body2" semiBold>
                {field.publicLabel}
            </Typography>
            {field.helpText ? (
                <Typography level="body3" className="text-muted-foreground">
                    {field.helpText}
                </Typography>
            ) : null}
        </>
    );
    const titleId = `${id}-title`;
    const titleClassName = 'flex min-w-0 flex-1 flex-col gap-1';

    function handleRestore() {
        // The restore control disappears with the change, so hand focus to
        // the field it belonged to before it goes.
        (
            document.getElementById(id) ??
            document.getElementById(`${id}-min`) ??
            document.getElementById(titleId)
        )?.focus();
        if (field.controlType === 'markdown') {
            setRestoreCount((count) => count + 1);
        }
        onChange(initialFieldValue(field));
    }

    return (
        <Stack
            className={cx(
                'rounded-lg border border-border/70 bg-muted/30 p-3 shadow-sm',
                group === 'attributes' && 'h-full min-w-0',
                changed && 'border-green-700/40',
                error && 'border-red-700/40',
            )}
            data-field-changed={changed ? '' : undefined}
            data-field-group={group}
            data-field-key={field.fieldKey}
            spacing={2}
        >
            <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-1">
                {icon ? (
                    <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground shadow-xs"
                        data-field-icon={field.fieldKey}
                    >
                        {icon}
                    </span>
                ) : null}
                {editable ? (
                    <label
                        className={titleClassName}
                        htmlFor={id}
                        id={titleId}
                        tabIndex={-1}
                    >
                        {title}
                    </label>
                ) : (
                    <div className={titleClassName}>{title}</div>
                )}
                {changed || error ? (
                    <div className="relative flex shrink-0 items-center gap-2">
                        {changed ? (
                            <Chip color="success" size="sm" variant="soft">
                                Izmijenjeno
                            </Chip>
                        ) : null}
                        <Button
                            onClick={handleRestore}
                            size="xs"
                            type="button"
                            variant="link"
                        >
                            Vrati
                            <span className="sr-only">
                                {' '}
                                – {field.publicLabel}
                            </span>
                        </Button>
                    </div>
                ) : null}
            </div>
            <CommunityEditFieldInput
                errorId={errorId}
                field={field}
                id={id}
                invalid={Boolean(error)}
                key={`${field.baseValueHash}:${restoreCount.toString()}`}
                onChange={onChange}
                value={value}
            />
            {error ? (
                <Typography
                    className="text-red-700 dark:text-red-300"
                    id={errorId}
                    level="body3"
                >
                    {error}
                </Typography>
            ) : null}
            {publishedValue ? (
                <Typography level="body3" className="text-muted-foreground">
                    Objavljeno: {publishedValue}
                </Typography>
            ) : null}
        </Stack>
    );
}
