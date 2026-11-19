'use client';

import { clientAuthenticated } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Send } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { myCommunityEditsQueryKey } from '../../hooks/useMyCommunityEdits';
import { InlineLoginDialog } from '../auth/InlineLoginDialog';
import { CommunityDialogFooter } from './CommunityDialogFooter';
import { CommunityDialogFrame } from './CommunityDialogFrame';
import { CommunityDialogSkeleton } from './CommunityDialogSkeleton';
import type { CommunityEditButtonProps } from './CommunityEditButton.types';
import { CommunityEditField } from './CommunityEditField';
import { CommunityRewardHint } from './CommunityRewardHint';
import { CommunitySubmissionSteps } from './CommunitySubmissionSteps';
import { CommunitySuccessFooter } from './CommunitySuccessFooter';
import {
    inputControlClassName,
    textareaControlClassName,
} from './communityControlStyles';
import { communityEditReturnPath } from './communityEditContext';
import {
    type CommunityEditableField,
    type CommunityEditFieldGroup,
    changeCountLabel,
    communityEditFieldGroup,
    communityEditFieldGroupLabel,
    communityEditFieldGroups,
    type FieldValue,
    fieldChanged,
    fieldValueError,
    initialFieldValue,
    isFieldsResponse,
    maxCommunityEditChanges,
    serializeFieldValue,
} from './communityEditFields';
import {
    communityLoginDescription,
    communityReasonMaxLength,
    communitySourceMaxLength,
    communitySubmitFailedMessage,
    communitySubmitLabel,
    composeSubmitterNote,
    errorMessage,
    isSubmitResponse,
} from './communitySuggestionUtils';

type Draft = {
    values: Record<string, FieldValue>;
    /** Hash of the published value each draft value was started from. */
    bases: Record<string, string>;
};

const emptyDraft: Draft = { values: {}, bases: {} };

export function CommunityEditDialog({
    open,
    onOpenChange: setOpen,
    entityId,
    entityName,
    entityTypeName,
    fieldKey,
    label,
    publicPath,
    sectionKey,
    sectionLabel,
}: CommunityEditButtonProps & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [fields, setFields] = useState<CommunityEditableField[]>([]);
    const [draft, setDraft] = useState(emptyDraft);
    const [source, setSource] = useState('');
    const [reason, setReason] = useState('');
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{
        requestId: number;
        summary: string;
    } | null>(null);
    const fieldIdPrefix = useId();
    const queryClient = useQueryClient();
    const { data: user, isLoading: isLoadingUser } = useCurrentUser();
    const communityEditEntityKey = `${entityTypeName}:${entityId}`;
    const communityEditSectionKey = sectionKey ?? '';
    const communityEditFieldKey = fieldKey ?? '';
    const communityEditReturnTo = useMemo(
        () =>
            communityEditReturnPath({
                entityKey: communityEditEntityKey,
                fallbackPath: publicPath,
                fieldKey: communityEditFieldKey,
                sectionKey: communityEditSectionKey,
            }),
        [
            communityEditEntityKey,
            communityEditFieldKey,
            communityEditSectionKey,
            publicPath,
        ],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: `loadAttempt` re-runs the load after a failure.
    useEffect(() => {
        if (!open || !user) {
            return;
        }

        let isMounted = true;
        async function loadFields() {
            setIsLoadingFields(true);
            setLoadError(null);
            setSubmitError(null);
            setSuccess(null);
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

                const editableFields = fieldKey
                    ? data.fields.filter((field) => field.fieldKey === fieldKey)
                    : data.fields;
                setFields(editableFields);
                // Keep what the visitor already changed. A value is started
                // over only when the published value it was based on changed.
                setDraft((current) => {
                    const next: Draft = { values: {}, bases: {} };
                    for (const field of editableFields) {
                        const previous = current.values[field.fieldKey];
                        next.values[field.fieldKey] =
                            previous !== undefined &&
                            current.bases[field.fieldKey] ===
                                field.baseValueHash
                                ? previous
                                : initialFieldValue(field);
                        next.bases[field.fieldKey] = field.baseValueHash;
                    }
                    return next;
                });
            } catch (error) {
                if (isMounted) {
                    setLoadError(
                        error instanceof Error &&
                            error.message !== communitySubmitFailedMessage
                            ? error.message
                            : 'Učitavanje polja nije uspjelo.',
                    );
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
    }, [
        entityId,
        entityTypeName,
        fieldKey,
        loadAttempt,
        open,
        sectionKey,
        user,
    ]);

    function fieldValue(field: CommunityEditableField) {
        return draft.values[field.fieldKey] ?? initialFieldValue(field);
    }

    const changedFields = fields.filter((field) =>
        fieldChanged(field, fieldValue(field)),
    );
    const hasInvalidFields = fields.some((field) =>
        fieldValueError(field, fieldValue(field)),
    );
    const exceedsChangeLimit = changedFields.length > maxCommunityEditChanges;
    const hasOnlyOperationSuggestions =
        fields.length > 0 &&
        fields.every((field) => field.controlType === 'operationSuggestion');
    const context =
        [entityName, sectionLabel].filter(Boolean).join(' · ') || null;
    const changeSummary = `${changeCountLabel(changedFields.length)}: ${changedFields
        .map((field) => field.publicLabel)
        .join(', ')}`;

    async function handleSubmit() {
        setSubmitError(null);
        setIsSubmitting(true);
        try {
            const changes = changedFields.map((field) => ({
                fieldKey: field.fieldKey,
                proposedValue: serializeFieldValue(field, fieldValue(field))
                    .submitValue,
                baseValueHash: field.baseValueHash,
            }));

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
                    submitterNote: hasOnlyOperationSuggestions
                        ? null
                        : composeSubmitterNote(source, reason),
                    changes,
                },
            });

            if (!response.ok) {
                const body: unknown = await response.json().catch(() => null);
                throw new Error(errorMessage(body));
            }

            const result: unknown = await response.json();
            if (!isSubmitResponse(result)) {
                throw new Error(communitySubmitFailedMessage);
            }
            setSuccess({
                requestId: result.requestId,
                summary: changeCountLabel(changes.length),
            });
            setDraft(emptyDraft);
            setSource('');
            setReason('');
            await queryClient.invalidateQueries({
                queryKey: myCommunityEditsQueryKey,
            });
        } catch (error) {
            setSubmitError(errorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    function renderEditableFieldGroup(group: CommunityEditFieldGroup) {
        const groupFields = fields.filter(
            (field) => communityEditFieldGroup(field) === group,
        );
        if (groupFields.length === 0) {
            return null;
        }

        const headingId = `${fieldIdPrefix}-${group}-heading`;
        return (
            <section
                aria-labelledby={headingId}
                className="flex flex-col gap-3"
                data-community-edit-group={group}
                key={group}
            >
                <Typography id={headingId} level="body2" semiBold>
                    {communityEditFieldGroupLabel(group, entityTypeName)}
                </Typography>
                <div
                    className={
                        group === 'attributes'
                            ? 'grid gap-3 md:grid-cols-2'
                            : 'flex flex-col gap-3'
                    }
                >
                    {groupFields.map((field) => (
                        <CommunityEditField
                            field={field}
                            idPrefix={fieldIdPrefix}
                            key={field.fieldKey}
                            onChange={(nextValue) =>
                                setDraft((current) => ({
                                    values: {
                                        ...current.values,
                                        [field.fieldKey]: nextValue,
                                    },
                                    bases: {
                                        ...current.bases,
                                        [field.fieldKey]: field.baseValueHash,
                                    },
                                }))
                            }
                            value={fieldValue(field)}
                        />
                    ))}
                </div>
            </section>
        );
    }

    // The sign-in check decides which dialog opens. Showing neither while it
    // runs avoids flashing the form shell at visitors who must sign in first.
    if (isLoadingUser) {
        return null;
    }

    const triggerLabel = label ?? 'Predloži izmjenu';
    const showSkeleton = isLoadingFields && fields.length === 0;

    return (
        <>
            <InlineLoginDialog
                description={communityLoginDescription}
                onAuthenticated={() => setOpen(true)}
                onOpenChange={setOpen}
                open={open && !user}
                returnTo={communityEditReturnTo}
            />
            <CommunityDialogFrame
                context={context}
                description={
                    success
                        ? `Prijedlog #${success.requestId.toString()} · ${success.summary}`
                        : undefined
                }
                onOpenChange={setOpen}
                open={open && Boolean(user)}
                size="lg"
                title={success ? 'Prijedlog je poslan' : triggerLabel}
            >
                {success ? (
                    <Stack spacing={4}>
                        <CommunitySubmissionSteps />
                        <CommunityRewardHint />
                    </Stack>
                ) : (
                    <Stack spacing={4}>
                        {showSkeleton ? (
                            <CommunityDialogSkeleton />
                        ) : loadError ? (
                            <Stack spacing={3}>
                                <Alert color="danger">{loadError}</Alert>
                                <Button
                                    className="self-start"
                                    onClick={() =>
                                        setLoadAttempt((attempt) => attempt + 1)
                                    }
                                    type="button"
                                    variant="outlined"
                                >
                                    Pokušaj ponovno
                                </Button>
                            </Stack>
                        ) : fields.length === 0 ? (
                            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                                <Typography level="body2">
                                    Ova sekcija trenutno nema javno uređivih
                                    polja.
                                </Typography>
                            </div>
                        ) : (
                            <Stack spacing={4}>
                                {communityEditFieldGroups.map(
                                    renderEditableFieldGroup,
                                )}
                            </Stack>
                        )}

                        {fields.length > 0 && !hasOnlyOperationSuggestions ? (
                            <Stack spacing={3}>
                                <Input
                                    className={inputControlClassName}
                                    fullWidth
                                    id={`${fieldIdPrefix}-source`}
                                    label="Izvor (opcionalno)"
                                    maxLength={communitySourceMaxLength}
                                    onChange={(event) =>
                                        setSource(event.currentTarget.value)
                                    }
                                    placeholder="Poveznica, knjiga ili vlastito iskustvo"
                                    value={source}
                                />
                                <label
                                    className="flex flex-col gap-1"
                                    htmlFor={`${fieldIdPrefix}-reason`}
                                >
                                    <span className="block text-sm font-medium text-foreground">
                                        Zašto predlažeš izmjenu? (opcionalno)
                                    </span>
                                    <textarea
                                        className={cx(
                                            textareaControlClassName,
                                            'min-h-20',
                                        )}
                                        id={`${fieldIdPrefix}-reason`}
                                        maxLength={communityReasonMaxLength}
                                        onChange={(event) =>
                                            setReason(event.currentTarget.value)
                                        }
                                        value={reason}
                                    />
                                </label>
                            </Stack>
                        ) : null}

                        {submitError ? (
                            <Alert color="danger">{submitError}</Alert>
                        ) : null}
                        <CommunityRewardHint />
                    </Stack>
                )}
                <CommunityDialogFooter>
                    {success ? (
                        <CommunitySuccessFooter
                            onClose={() => setOpen(false)}
                        />
                    ) : (
                        <>
                            <Typography
                                aria-live="polite"
                                className="min-w-0 flex-1 basis-48 text-muted-foreground"
                                data-community-edit-summary
                                level="body2"
                            >
                                {hasInvalidFields
                                    ? 'Ispravi označena polja prije slanja.'
                                    : exceedsChangeLimit
                                      ? `Jedan prijedlog može imati najviše ${maxCommunityEditChanges.toString()} izmjena, a sada ih je ${changedFields.length.toString()}. Vrati dio izmjena i pošalji ih u sljedećem prijedlogu.`
                                      : changedFields.length > 0
                                        ? changeSummary
                                        : 'Promijeni barem jedno polje da pošalješ prijedlog.'}
                            </Typography>
                            <Row spacing={2} className="ml-auto shrink-0">
                                <Button
                                    onClick={() => setOpen(false)}
                                    type="button"
                                    variant="plain"
                                >
                                    Odustani
                                </Button>
                                <Button
                                    disabled={
                                        isLoadingFields ||
                                        hasInvalidFields ||
                                        exceedsChangeLimit ||
                                        changedFields.length === 0
                                    }
                                    endDecorator={<Send className="size-4" />}
                                    loading={isSubmitting}
                                    onClick={handleSubmit}
                                    type="button"
                                >
                                    {communitySubmitLabel}
                                </Button>
                            </Row>
                        </>
                    )}
                </CommunityDialogFooter>
            </CommunityDialogFrame>
        </>
    );
}
