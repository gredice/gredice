'use client';

import type { AutomationModuleMetadata } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type KeyboardEvent, useId, useState } from 'react';
import {
    jsonFieldValue,
    multiselectFieldValue,
    parseJsonField,
    toggleMultiselectFieldValue,
} from './automationConfigFieldValues';
import {
    automationConfigFieldDescription,
    automationConfigFieldLabel,
    automationConfigFieldOptionLabel,
    automationConfigFieldPlaceholder,
} from './presentation';

type AutomationConfigField = AutomationModuleMetadata['configFields'][number];

type AutomationConfigFieldInputProps = {
    module: AutomationModuleMetadata;
    field: AutomationConfigField;
    value: unknown;
    onChange(value: unknown): void;
};

function FieldDescription({
    children,
    id,
}: {
    children: string | undefined;
    id?: string;
}) {
    if (!children) {
        return null;
    }

    return (
        <Typography id={id} level="body3" className="text-muted-foreground">
            {children}
        </Typography>
    );
}

/**
 * Keeps the typed JSON as a local draft and only applies it to the node config
 * on blur, on the explicit apply button or on Ctrl/Cmd+Enter, so partially
 * typed JSON is never parsed on every keystroke.
 */
function JsonConfigField({
    description,
    label,
    onChange,
    value,
}: {
    description: string | undefined;
    label: string;
    onChange(value: unknown): void;
    value: unknown;
}) {
    const id = useId();
    const appliedText = jsonFieldValue(value);
    const [syncedText, setSyncedText] = useState(appliedText);
    const [draft, setDraft] = useState(appliedText);
    const [error, setError] = useState<string | null>(null);

    // Follow config changes made outside of this field (node switch, reload).
    if (syncedText !== appliedText) {
        setSyncedText(appliedText);
        setDraft(appliedText);
        setError(null);
    }

    const isDirty = draft !== appliedText;
    const descriptionId = description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;

    function apply() {
        if (!isDirty) {
            setError(null);
            return;
        }

        const parsed = parseJsonField(draft);
        if (!parsed.ok) {
            setError(parsed.error);
            return;
        }

        const nextText = jsonFieldValue(parsed.value);
        setSyncedText(nextText);
        setDraft(nextText);
        setError(null);
        onChange(parsed.value);
    }

    function revert() {
        setDraft(appliedText);
        setError(null);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            apply();
        }
    }

    return (
        <Stack spacing={1}>
            <label className="text-sm font-medium" htmlFor={id}>
                {label}
            </label>
            <textarea
                id={id}
                value={draft}
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={
                    [descriptionId, errorId].filter(Boolean).join(' ') ||
                    undefined
                }
                onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                }}
                onBlur={apply}
                onKeyDown={handleKeyDown}
                className={cx(
                    'min-h-28 w-full rounded-md border bg-field px-3 py-2 font-mono text-xs outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    error
                        ? 'border-red-500 dark:border-red-400'
                        : 'border-input',
                )}
            />
            {error ? (
                <Typography
                    id={errorId}
                    role="alert"
                    level="body3"
                    className="text-red-700 dark:text-red-300"
                >
                    {error}
                </Typography>
            ) : null}
            <Row spacing={1} className="flex-wrap">
                <Button
                    type="button"
                    size="sm"
                    variant="soft"
                    disabled={!isDirty}
                    onClick={apply}
                >
                    Primijeni
                </Button>
                {error ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="plain"
                        onClick={revert}
                    >
                        Vrati spremljeno
                    </Button>
                ) : null}
                {isDirty && !error ? (
                    <Typography level="body3" className="text-muted-foreground">
                        Nije primijenjeno (Ctrl/Cmd + Enter)
                    </Typography>
                ) : null}
            </Row>
            <FieldDescription id={descriptionId}>
                {description}
            </FieldDescription>
        </Stack>
    );
}

function MultiselectConfigField({
    field,
    module,
    onChange,
    value,
}: AutomationConfigFieldInputProps) {
    const id = useId();
    const options = field.options ?? [];
    const { selected, unknown } = multiselectFieldValue(value, options);
    const description = automationConfigFieldDescription(module, field);

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
        <fieldset
            className="space-y-2"
            aria-describedby={description ? `${id}-description` : undefined}
        >
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
            <FieldDescription id={`${id}-description`}>
                {description}
            </FieldDescription>
        </fieldset>
    );
}

export function AutomationConfigFieldInput({
    field,
    module,
    onChange,
    value,
}: AutomationConfigFieldInputProps) {
    const label = automationConfigFieldLabel(module, field);
    const description = automationConfigFieldDescription(module, field);

    if (field.type === 'select') {
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
                <FieldDescription>{description}</FieldDescription>
            </Stack>
        );
    }

    if (field.type === 'multiselect') {
        return (
            <MultiselectConfigField
                field={field}
                module={module}
                onChange={onChange}
                value={value}
            />
        );
    }

    if (field.type === 'boolean') {
        return (
            <Checkbox
                label={label}
                checked={value === true}
                onCheckedChange={(checked) => onChange(checked === true)}
            />
        );
    }

    if (field.type === 'json') {
        return (
            <JsonConfigField
                description={description}
                label={label}
                onChange={onChange}
                value={value}
            />
        );
    }

    return (
        <Input
            label={label}
            helperText={description}
            placeholder={automationConfigFieldPlaceholder(module, field)}
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
