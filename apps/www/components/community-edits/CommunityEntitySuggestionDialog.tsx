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
import { type FormEvent, useId, useMemo, useState } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { myCommunityEditsQueryKey } from '../../hooks/useMyCommunityEdits';
import { InlineLoginDialog } from '../auth/InlineLoginDialog';
import { CommunityDialogFooter } from './CommunityDialogFooter';
import { CommunityDialogFrame } from './CommunityDialogFrame';
import type { CommunityEntitySuggestionButtonProps } from './CommunityEntitySuggestionButton.types';
import { CommunityRewardHint } from './CommunityRewardHint';
import { CommunitySubmissionSteps } from './CommunitySubmissionSteps';
import { CommunitySuccessFooter } from './CommunitySuccessFooter';
import {
    inputControlClassName,
    selectControlClassName,
    textareaControlClassName,
} from './communityControlStyles';
import {
    suggestionContextKey,
    suggestionLabels,
    suggestionReturnPath,
} from './communitySuggestionContext';
import {
    communityLoginDescription,
    communitySourceMaxLength,
    communitySubmitFailedMessage,
    communitySubmitLabel,
    errorMessage,
    isSubmitResponse,
} from './communitySuggestionUtils';
import { ExistingPlantHealthSuggestionForm } from './ExistingPlantHealthSuggestionForm';
import { PlantHealthSuggestionMode } from './PlantHealthSuggestionMode';
import { PlantReferencePicker } from './PlantReferencePicker';

type OperationApplication =
    | 'farm'
    | 'garden'
    | 'plant'
    | 'raisedBed1m'
    | 'raisedBedFull';

const applicationOptions: {
    value: OperationApplication;
    label: string;
}[] = [
    { value: 'plant', label: 'Biljka' },
    { value: 'raisedBedFull', label: 'Cijela gredica' },
    { value: 'raisedBed1m', label: 'Gredica 1 m²' },
    { value: 'garden', label: 'Vrt' },
    { value: 'farm', label: 'Farma' },
];

function isOperationApplication(value: string): value is OperationApplication {
    return applicationOptions.some((option) => option.value === value);
}

function isPlantHealthSuggestionKind(
    kind: CommunityEntitySuggestionButtonProps['kind'],
): kind is 'disease' | 'pest' {
    return kind === 'disease' || kind === 'pest';
}

/** What the suggestion is about, for the dialog header. */
function suggestionContext(props: CommunityEntitySuggestionButtonProps) {
    if (props.kind === 'plantSort' || props.kind === 'plantTip') {
        return props.parentPlantName;
    }

    if (props.kind === 'operation') {
        return (
            props.stages.find((stage) => stage.id === props.defaultStageId)
                ?.label ?? null
        );
    }

    return (
        props.plants.find(
            (plant) => plant.value === String(props.defaultAffectedPlantId),
        )?.label ?? null
    );
}

export function CommunityEntitySuggestionDialog({
    onOpenChange: setOpen,
    open,
    ...props
}: CommunityEntitySuggestionButtonProps & {
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const [healthMode, setHealthMode] = useState<'existing' | 'new'>(
        isPlantHealthSuggestionKind(props.kind) ? 'existing' : 'new',
    );
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState('');
    const [note, setNote] = useState('');
    const defaultStageId =
        props.kind === 'operation' ? props.defaultStageId : undefined;
    const [plantStageId, setPlantStageId] = useState(() =>
        defaultStageId ? String(defaultStageId) : '',
    );
    const defaultAffectedPlantId =
        props.kind === 'disease' || props.kind === 'pest'
            ? props.defaultAffectedPlantId
            : undefined;
    const [affectedPlantIds, setAffectedPlantIds] = useState<string[]>(() =>
        defaultAffectedPlantId ? [String(defaultAffectedPlantId)] : [],
    );
    const [symptoms, setSymptoms] = useState('');
    const [favorableConditions, setFavorableConditions] = useState('');
    const [severity, setSeverity] = useState('');
    const [application, setApplication] =
        useState<OperationApplication>('plant');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successRequestId, setSuccessRequestId] = useState<number | null>(
        null,
    );
    const [wasOpen, setWasOpen] = useState(open);
    const fieldIdPrefix = useId();
    const queryClient = useQueryClient();
    const { data: user, isLoading: isLoadingUser } = useCurrentUser();
    const contextKey = suggestionContextKey(props);
    const returnTo = useMemo(
        () => suggestionReturnPath(contextKey, props.publicPath),
        [contextKey, props.publicPath],
    );
    const labels = suggestionLabels(props.kind);

    function resetForm() {
        setHealthMode(
            isPlantHealthSuggestionKind(props.kind) ? 'existing' : 'new',
        );
        setName('');
        setDescription('');
        setSource('');
        setNote('');
        setPlantStageId(defaultStageId ? String(defaultStageId) : '');
        setAffectedPlantIds(
            defaultAffectedPlantId ? [String(defaultAffectedPlantId)] : [],
        );
        setSymptoms('');
        setFavorableConditions('');
        setSeverity('');
        setApplication('plant');
        setError(null);
        setSuccessRequestId(null);
    }

    // A draft survives closing the dialog. Once a suggestion was sent, the
    // next opening starts a new one.
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open && successRequestId) {
            resetForm();
        }
    }

    function handleSuccess(requestId: number) {
        setSuccessRequestId(requestId);
        void queryClient.invalidateQueries({
            queryKey: myCommunityEditsQueryKey,
        });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const trimmedName = name.trim();
            const trimmedDescription = description.trim();
            if (!trimmedName || !trimmedDescription) {
                throw new Error('Unesi naziv i opis prijedloga.');
            }
            const trimmedSymptoms = symptoms.trim();
            const trimmedFavorableConditions = favorableConditions.trim();
            if (
                isPlantHealthSuggestionKind(props.kind) &&
                (!trimmedSymptoms || !trimmedFavorableConditions)
            ) {
                throw new Error('Unesi simptome i uvjete pojave.');
            }
            if (
                isPlantHealthSuggestionKind(props.kind) &&
                affectedPlantIds.length === 0
            ) {
                throw new Error('Odaberi barem jednu pogođenu biljku.');
            }

            const suggestions =
                clientAuthenticated().api.directories['community-edits'][
                    'entity-suggestions'
                ];
            const response = await (async () => {
                if (props.kind === 'plantSort' || props.kind === 'plantTip') {
                    return await suggestions.$post({
                        json: {
                            kind: props.kind,
                            parentPlantId: props.parentPlantId,
                            name: trimmedName,
                            description: trimmedDescription,
                            source: source.trim() || null,
                            note: note.trim() || null,
                            publicPath: props.publicPath,
                        },
                    });
                }
                if (props.kind === 'operation') {
                    return await suggestions.$post({
                        json: {
                            kind: props.kind,
                            plantStageId: Number.parseInt(plantStageId, 10),
                            application,
                            name: trimmedName,
                            description: trimmedDescription,
                            source: source.trim() || null,
                            note: note.trim() || null,
                            publicPath: props.publicPath,
                        },
                    });
                }
                return await suggestions.$post({
                    json: {
                        kind: props.kind,
                        affectedPlantIds: affectedPlantIds.map((value) =>
                            Number.parseInt(value, 10),
                        ),
                        name: trimmedName,
                        description: trimmedDescription,
                        symptoms: trimmedSymptoms,
                        favorableConditions: trimmedFavorableConditions,
                        severity: severity.trim() || null,
                        source: source.trim() || null,
                        note: note.trim() || null,
                        publicPath: props.publicPath,
                    },
                });
            })();

            if (!response.ok) {
                const body: unknown = await response.json().catch(() => null);
                throw new Error(errorMessage(body));
            }

            const result: unknown = await response.json();
            if (!isSubmitResponse(result)) {
                throw new Error(communitySubmitFailedMessage);
            }
            handleSuccess(result.requestId);
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setIsSubmitting(false);
        }
    }

    // The sign-in check decides which dialog opens. Showing neither while it
    // runs avoids flashing the form shell at visitors who must sign in first.
    if (isLoadingUser) {
        return null;
    }

    return (
        <>
            <InlineLoginDialog
                description={communityLoginDescription}
                onAuthenticated={() => setOpen(true)}
                onOpenChange={setOpen}
                open={open && !user}
                returnTo={returnTo}
            />
            <CommunityDialogFrame
                context={suggestionContext(props)}
                description={
                    successRequestId
                        ? `Prijedlog #${successRequestId.toString()}`
                        : undefined
                }
                onOpenChange={setOpen}
                open={open && Boolean(user)}
                title={successRequestId ? 'Prijedlog je poslan' : labels.title}
            >
                {successRequestId ? (
                    <>
                        <Stack spacing={4}>
                            <CommunitySubmissionSteps />
                            <CommunityRewardHint />
                        </Stack>
                        <CommunityDialogFooter>
                            <CommunitySuccessFooter
                                onClose={() => setOpen(false)}
                            />
                        </CommunityDialogFooter>
                    </>
                ) : (
                    <>
                        {isPlantHealthSuggestionKind(props.kind) ? (
                            <PlantHealthSuggestionMode
                                kind={props.kind}
                                value={healthMode}
                                onChange={setHealthMode}
                            />
                        ) : null}
                        {(props.kind === 'disease' || props.kind === 'pest') &&
                        healthMode === 'existing' ? (
                            <ExistingPlantHealthSuggestionForm
                                kind={props.kind}
                                plants={props.plants}
                                defaultAffectedPlantId={
                                    props.defaultAffectedPlantId
                                }
                                publicPath={props.publicPath}
                                onCancel={() => setOpen(false)}
                                onSuccess={handleSuccess}
                            />
                        ) : (
                            <form
                                className="flex flex-col gap-4"
                                onSubmit={handleSubmit}
                            >
                                {props.kind === 'operation' ? (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label
                                            className="flex flex-col gap-1"
                                            htmlFor={`${fieldIdPrefix}-stage`}
                                        >
                                            <Typography level="body2" semiBold>
                                                Stadij biljke
                                            </Typography>
                                            <select
                                                className={
                                                    selectControlClassName
                                                }
                                                id={`${fieldIdPrefix}-stage`}
                                                onChange={(event) =>
                                                    setPlantStageId(
                                                        event.currentTarget
                                                            .value,
                                                    )
                                                }
                                                required
                                                value={plantStageId}
                                            >
                                                <option value="">
                                                    Odaberi stadij
                                                </option>
                                                {props.stages.map((stage) => (
                                                    <option
                                                        key={stage.id}
                                                        value={stage.id}
                                                    >
                                                        {stage.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label
                                            className="flex flex-col gap-1"
                                            htmlFor={`${fieldIdPrefix}-application`}
                                        >
                                            <Typography level="body2" semiBold>
                                                Primjena
                                            </Typography>
                                            <select
                                                className={
                                                    selectControlClassName
                                                }
                                                id={`${fieldIdPrefix}-application`}
                                                onChange={(event) => {
                                                    const nextApplication =
                                                        event.currentTarget
                                                            .value;
                                                    if (
                                                        isOperationApplication(
                                                            nextApplication,
                                                        )
                                                    ) {
                                                        setApplication(
                                                            nextApplication,
                                                        );
                                                    }
                                                }}
                                                value={application}
                                            >
                                                {applicationOptions.map(
                                                    (option) => (
                                                        <option
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                    </div>
                                ) : props.kind === 'disease' ||
                                  props.kind === 'pest' ? (
                                    <div className="flex flex-col gap-1">
                                        <label
                                            htmlFor={`${fieldIdPrefix}-affected-plants`}
                                        >
                                            <Typography level="body2" semiBold>
                                                Pogođene biljke
                                            </Typography>
                                        </label>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Odaberi barem jednu biljku na kojoj
                                            se problem pojavljuje.
                                        </Typography>
                                        <PlantReferencePicker
                                            id={`${fieldIdPrefix}-affected-plants`}
                                            label="Pogođene biljke"
                                            onValueChange={setAffectedPlantIds}
                                            options={props.plants}
                                            selectedValues={affectedPlantIds}
                                        />
                                    </div>
                                ) : null}

                                <Input
                                    className={inputControlClassName}
                                    fullWidth
                                    label={labels.name}
                                    maxLength={200}
                                    onChange={(event) =>
                                        setName(event.currentTarget.value)
                                    }
                                    required
                                    value={name}
                                />
                                <label
                                    className="flex flex-col gap-1"
                                    htmlFor={`${fieldIdPrefix}-description`}
                                >
                                    <Typography level="body2" semiBold>
                                        {labels.description}
                                    </Typography>
                                    <textarea
                                        className={cx(
                                            textareaControlClassName,
                                            'min-h-28',
                                        )}
                                        id={`${fieldIdPrefix}-description`}
                                        maxLength={2000}
                                        onChange={(event) =>
                                            setDescription(
                                                event.currentTarget.value,
                                            )
                                        }
                                        required
                                        value={description}
                                    />
                                </label>
                                {isPlantHealthSuggestionKind(props.kind) ? (
                                    <>
                                        <label
                                            className="flex flex-col gap-1"
                                            htmlFor={`${fieldIdPrefix}-symptoms`}
                                        >
                                            <Typography level="body2" semiBold>
                                                Simptomi
                                            </Typography>
                                            <textarea
                                                className={cx(
                                                    textareaControlClassName,
                                                    'min-h-28',
                                                )}
                                                id={`${fieldIdPrefix}-symptoms`}
                                                maxLength={4000}
                                                onChange={(event) =>
                                                    setSymptoms(
                                                        event.currentTarget
                                                            .value,
                                                    )
                                                }
                                                required
                                                value={symptoms}
                                            />
                                        </label>
                                        <label
                                            className="flex flex-col gap-1"
                                            htmlFor={`${fieldIdPrefix}-conditions`}
                                        >
                                            <Typography level="body2" semiBold>
                                                Uvjeti pojave
                                            </Typography>
                                            <textarea
                                                className={cx(
                                                    textareaControlClassName,
                                                    'min-h-28',
                                                )}
                                                id={`${fieldIdPrefix}-conditions`}
                                                maxLength={4000}
                                                onChange={(event) =>
                                                    setFavorableConditions(
                                                        event.currentTarget
                                                            .value,
                                                    )
                                                }
                                                required
                                                value={favorableConditions}
                                            />
                                        </label>
                                        <Input
                                            className={inputControlClassName}
                                            fullWidth
                                            label="Ozbiljnost (opcionalno)"
                                            maxLength={1000}
                                            onChange={(event) =>
                                                setSeverity(
                                                    event.currentTarget.value,
                                                )
                                            }
                                            value={severity}
                                        />
                                    </>
                                ) : null}
                                <Input
                                    className={inputControlClassName}
                                    fullWidth
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
                                    htmlFor={`${fieldIdPrefix}-note`}
                                >
                                    <Typography level="body2" semiBold>
                                        Napomena za moderatora (opcionalno)
                                    </Typography>
                                    <textarea
                                        className={cx(
                                            textareaControlClassName,
                                            'min-h-20',
                                        )}
                                        id={`${fieldIdPrefix}-note`}
                                        maxLength={1000}
                                        onChange={(event) =>
                                            setNote(event.currentTarget.value)
                                        }
                                        value={note}
                                    />
                                </label>

                                {error ? (
                                    <Alert color="danger">{error}</Alert>
                                ) : null}
                                <CommunityRewardHint />
                                <CommunityDialogFooter>
                                    <Row
                                        spacing={2}
                                        className="ml-auto shrink-0"
                                    >
                                        <Button
                                            onClick={() => setOpen(false)}
                                            type="button"
                                            variant="plain"
                                        >
                                            Odustani
                                        </Button>
                                        <Button
                                            endDecorator={
                                                <Send className="size-4" />
                                            }
                                            loading={isSubmitting}
                                            type="submit"
                                        >
                                            {communitySubmitLabel}
                                        </Button>
                                    </Row>
                                </CommunityDialogFooter>
                            </form>
                        )}
                    </>
                )}
            </CommunityDialogFrame>
        </>
    );
}
