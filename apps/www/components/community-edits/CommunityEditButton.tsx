'use client';

import { clientAuthenticated } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Check, Edit, Send } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useState } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { KnownPages } from '../../src/KnownPages';

const CommunityMarkdownInput = dynamic(
    () =>
        import('./CommunityMarkdownInput').then(
            (module) => module.CommunityMarkdownInput,
        ),
    {
        ssr: false,
    },
);

type CommunityEditControlType =
    | 'boolean'
    | 'json'
    | 'markdown'
    | 'number'
    | 'range'
    | 'reference'
    | 'text';

type CommunityEditableField = {
    entityTypeName: string;
    entityId: number;
    fieldKey: string;
    sectionKey: string;
    attributeDefinitionId: number;
    attributeValueId: number | null;
    attributePath: string;
    dataType: string;
    controlType: CommunityEditControlType;
    multiple: boolean;
    publicLabel: string;
    helpText?: string;
    currentValue: string | null;
    baseValueHash: string;
};

type FieldValue =
    | string
    | {
          min: string;
          max: string;
      }
    | null;

type SubmitValue =
    | string
    | {
          min: number;
          max: number;
      }
    | null;

type ButtonStyle = 'button' | 'icon';

export type CommunityEditButtonProps = {
    entityTypeName: 'block' | 'operation' | 'plant' | 'plantSort';
    entityId: number;
    publicPath: string;
    sectionKey?: string;
    label?: string;
    buttonStyle?: ButtonStyle;
    className?: string;
};

function initialFieldValue(field: CommunityEditableField): FieldValue {
    if (field.controlType === 'range') {
        if (!field.currentValue) {
            return { min: '', max: '' };
        }

        try {
            const parsed: unknown = JSON.parse(field.currentValue);
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'min' in parsed &&
                'max' in parsed
            ) {
                return {
                    min:
                        typeof parsed.min === 'number'
                            ? String(parsed.min)
                            : '',
                    max:
                        typeof parsed.max === 'number'
                            ? String(parsed.max)
                            : '',
                };
            }
        } catch {
            return { min: '', max: '' };
        }
    }

    return field.currentValue ?? '';
}

function normalizeJsonValue(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return JSON.stringify(JSON.parse(trimmed));
    } catch {
        return trimmed;
    }
}

function serializeFieldValue(
    field: CommunityEditableField,
    value: FieldValue,
): { comparisonValue: string | null; submitValue: SubmitValue } {
    if (field.controlType === 'range') {
        if (!value || typeof value === 'string') {
            return { comparisonValue: null, submitValue: null };
        }

        if (!value.min.trim() && !value.max.trim()) {
            return { comparisonValue: null, submitValue: null };
        }

        const rangeValue = {
            min: Number.parseFloat(value.min),
            max: Number.parseFloat(value.max),
        };

        return {
            comparisonValue: JSON.stringify(rangeValue),
            submitValue: rangeValue,
        };
    }

    const textValue = typeof value === 'string' ? value : '';
    if (field.controlType === 'json') {
        const normalized = normalizeJsonValue(textValue);
        return { comparisonValue: normalized, submitValue: textValue || null };
    }

    if (!textValue.length) {
        return { comparisonValue: null, submitValue: null };
    }

    return {
        comparisonValue: textValue,
        submitValue: textValue,
    };
}

function fieldChanged(field: CommunityEditableField, value: FieldValue) {
    return (
        serializeFieldValue(field, value).comparisonValue !== field.currentValue
    );
}

function errorMessage(error: unknown) {
    if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
    ) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Slanje prijedloga nije uspjelo.';
}

function fieldInputId(prefix: string, field: CommunityEditableField) {
    return `${prefix}-${field.fieldKey.replace(/[^a-z0-9_-]/giu, '-')}`;
}

function isCommunityEditableField(
    value: unknown,
): value is CommunityEditableField {
    return (
        typeof value === 'object' &&
        value !== null &&
        'fieldKey' in value &&
        typeof value.fieldKey === 'string' &&
        'publicLabel' in value &&
        typeof value.publicLabel === 'string' &&
        'controlType' in value &&
        typeof value.controlType === 'string' &&
        'currentValue' in value &&
        (typeof value.currentValue === 'string' ||
            value.currentValue === null) &&
        'baseValueHash' in value &&
        typeof value.baseValueHash === 'string'
    );
}

function isFieldsResponse(
    value: unknown,
): value is { fields: CommunityEditableField[] } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'fields' in value &&
        Array.isArray(value.fields) &&
        value.fields.every(isCommunityEditableField)
    );
}

function isSubmitResponse(value: unknown): value is { requestId: number } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'requestId' in value &&
        typeof value.requestId === 'number'
    );
}

function FieldInput({
    field,
    id,
    onChange,
    value,
}: {
    field: CommunityEditableField;
    id: string;
    onChange: (value: FieldValue) => void;
    value: FieldValue;
}) {
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
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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

    if (field.controlType === 'number' || field.controlType === 'reference') {
        return (
            <Input
                id={id}
                inputMode={
                    field.controlType === 'reference' ? 'numeric' : 'decimal'
                }
                onChange={(event) => onChange(event.currentTarget.value)}
                type={field.controlType === 'reference' ? 'text' : 'number'}
                value={typeof value === 'string' ? value : ''}
            />
        );
    }

    if (field.controlType === 'range') {
        const rangeValue =
            value && typeof value !== 'string'
                ? value
                : {
                      min: '',
                      max: '',
                  };
        return (
            <div className="grid gap-2 sm:grid-cols-2">
                <Input
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

    if (field.controlType === 'json') {
        return (
            <textarea
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                value={typeof value === 'string' ? value : ''}
            />
        );
    }

    return (
        <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            id={id}
            onChange={(event) => onChange(event.currentTarget.value)}
            value={typeof value === 'string' ? value : ''}
        />
    );
}

export function CommunityEditButton({
    buttonStyle = 'icon',
    className,
    entityId,
    entityTypeName,
    label,
    publicPath,
    sectionKey,
}: CommunityEditButtonProps) {
    const [open, setOpen] = useState(false);
    const [fields, setFields] = useState<CommunityEditableField[]>([]);
    const [values, setValues] = useState<Record<string, FieldValue>>({});
    const [submitterNote, setSubmitterNote] = useState('');
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successRequestId, setSuccessRequestId] = useState<number | null>(
        null,
    );
    const fieldIdPrefix = useId();
    const { data: user, isLoading: isLoadingUser } = useCurrentUser();

    useEffect(() => {
        if (!open || !user) {
            return;
        }

        let isMounted = true;
        async function loadFields() {
            setIsLoadingFields(true);
            setError(null);
            setSuccessRequestId(null);
            try {
                const response = await clientAuthenticated().api.directories[
                    'community-edits'
                ].entities[':entityType'][':entityId'].fields.$get({
                    param: {
                        entityType: entityTypeName,
                        entityId: entityId.toString(),
                    },
                    query: sectionKey ? { sectionKey } : {},
                });
                if (!response.ok) {
                    const body: unknown = await response
                        .json()
                        .catch(() => null);
                    throw new Error(errorMessage(body));
                }

                const data: unknown = await response.json();
                if (!isFieldsResponse(data)) {
                    throw new Error('Učitavanje polja nije uspjelo.');
                }
                if (!isMounted) {
                    return;
                }

                setFields(data.fields);
                setValues(
                    Object.fromEntries(
                        data.fields.map((field) => [
                            field.fieldKey,
                            initialFieldValue(field),
                        ]),
                    ),
                );
            } catch (loadError) {
                if (isMounted) {
                    setError(errorMessage(loadError));
                }
            } finally {
                if (isMounted) {
                    setIsLoadingFields(false);
                }
            }
        }

        loadFields();
        return () => {
            isMounted = false;
        };
    }, [entityId, entityTypeName, open, sectionKey, user]);

    const changedFields = useMemo(
        () =>
            fields.filter((field) =>
                fieldChanged(field, values[field.fieldKey] ?? ''),
            ),
        [fields, values],
    );

    async function handleSubmit() {
        setError(null);
        setIsSubmitting(true);
        try {
            const changes = changedFields.map((field) => {
                const serialized = serializeFieldValue(
                    field,
                    values[field.fieldKey] ?? '',
                );
                return {
                    fieldKey: field.fieldKey,
                    proposedValue: serialized.submitValue,
                    baseValueHash: field.baseValueHash,
                };
            });

            if (changes.length === 0) {
                throw new Error('Promijeni barem jedno polje prije slanja.');
            }

            const response = await clientAuthenticated().api.directories[
                'community-edits'
            ].$post({
                json: {
                    entityTypeName,
                    entityId,
                    publicPath,
                    sectionKey: sectionKey ?? null,
                    submitterNote: submitterNote.trim() || null,
                    changes,
                },
            });

            if (!response.ok) {
                const body: unknown = await response.json().catch(() => null);
                throw new Error(errorMessage(body));
            }

            const result: unknown = await response.json();
            if (!isSubmitResponse(result)) {
                throw new Error('Slanje prijedloga nije uspjelo.');
            }
            setSuccessRequestId(result.requestId);
            setSubmitterNote('');
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setIsSubmitting(false);
        }
    }

    const triggerLabel = label ?? 'Predloži izmjenu';
    const trigger =
        buttonStyle === 'button' ? (
            <Button
                className={className}
                size="sm"
                startDecorator={<Edit className="size-4" />}
                type="button"
                variant="outlined"
            >
                {triggerLabel}
            </Button>
        ) : (
            <IconButton
                className={cx('shrink-0', className)}
                title={triggerLabel}
                type="button"
                variant="plain"
            >
                <Edit className="size-4" />
            </IconButton>
        );

    return (
        <Modal
            className="max-w-3xl"
            onOpenChange={setOpen}
            open={open}
            title={triggerLabel}
            trigger={trigger}
        >
            <Stack spacing={4}>
                <Row spacing={2} className="items-start justify-between gap-4">
                    <Stack spacing={1}>
                        <Typography level="h3">{triggerLabel}</Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Prijedlog ide na administratorsko odobrenje prije
                            objave.
                        </Typography>
                    </Stack>
                    {successRequestId ? (
                        <Check className="size-5 shrink-0 text-green-700" />
                    ) : null}
                </Row>

                {isLoadingUser ? (
                    <Typography level="body2">
                        Provjeravam prijavu...
                    </Typography>
                ) : !user ? (
                    <Stack spacing={3}>
                        <Typography level="body2">
                            Za slanje prijedloga trebaš biti prijavljen.
                        </Typography>
                        <Button href={KnownPages.GardenApp} variant="outlined">
                            Prijavi se u vrt
                        </Button>
                    </Stack>
                ) : successRequestId ? (
                    <Stack spacing={2}>
                        <Typography>
                            Prijedlog #{successRequestId} je poslan na
                            odobrenje.
                        </Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Hvala ti. Sadržaj neće biti javno promijenjen dok ga
                            administrator ne pregleda.
                        </Typography>
                    </Stack>
                ) : (
                    <Stack spacing={4}>
                        {isLoadingFields ? (
                            <Typography level="body2">
                                Učitavam polja...
                            </Typography>
                        ) : fields.length === 0 ? (
                            <Typography level="body2">
                                Ova sekcija trenutno nema javno uređivih polja.
                            </Typography>
                        ) : (
                            fields.map((field) => {
                                const id = fieldInputId(fieldIdPrefix, field);
                                return (
                                    <Stack key={field.fieldKey} spacing={2}>
                                        <label htmlFor={id}>
                                            <Typography level="body2" semiBold>
                                                {field.publicLabel}
                                            </Typography>
                                            {field.helpText ? (
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    {field.helpText}
                                                </Typography>
                                            ) : null}
                                        </label>
                                        <FieldInput
                                            field={field}
                                            id={id}
                                            onChange={(nextValue) =>
                                                setValues((current) => ({
                                                    ...current,
                                                    [field.fieldKey]: nextValue,
                                                }))
                                            }
                                            value={
                                                values[field.fieldKey] ??
                                                initialFieldValue(field)
                                            }
                                        />
                                    </Stack>
                                );
                            })
                        )}

                        <label className="space-y-1">
                            <Typography level="body2">
                                Napomena za administratora
                            </Typography>
                            <textarea
                                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                onChange={(event) =>
                                    setSubmitterNote(event.currentTarget.value)
                                }
                                placeholder="Kratko objasni izvor ili razlog promjene..."
                                value={submitterNote}
                            />
                        </label>

                        {error ? (
                            <Typography level="body2" className="text-red-700">
                                {error}
                            </Typography>
                        ) : null}

                        <Row spacing={2} className="justify-end">
                            <Button
                                disabled={
                                    isLoadingFields ||
                                    changedFields.length === 0
                                }
                                endDecorator={<Send className="size-4" />}
                                loading={isSubmitting}
                                onClick={handleSubmit}
                                type="button"
                            >
                                Pošalji
                            </Button>
                        </Row>
                    </Stack>
                )}
            </Stack>
        </Modal>
    );
}
