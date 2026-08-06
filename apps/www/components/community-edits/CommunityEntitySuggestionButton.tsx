'use client';

import { clientAuthenticated } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Add, Check, Send } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { InlineLoginDialog } from '../auth/InlineLoginDialog';

const communitySuggestionParam = 'communitySuggestion';
const selectControlClassName =
    'h-10 w-full rounded-md border border-border/80 bg-card px-3 text-sm text-foreground shadow-sm ring-offset-background transition-colors hover:border-primary/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted/70 disabled:text-muted-foreground';
const textareaControlClassName =
    'w-full rounded-md border border-border/80 bg-card px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background transition-colors placeholder:text-muted-foreground/70 hover:border-primary/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted/70 disabled:text-muted-foreground';

type OperationApplication =
    | 'farm'
    | 'garden'
    | 'plant'
    | 'raisedBed1m'
    | 'raisedBedFull';

export type CommunityOperationSuggestionStage = {
    id: number;
    label: string;
};

type CommonProps = {
    className?: string;
    publicPath: string;
};

export type CommunityEntitySuggestionButtonProps = CommonProps &
    (
        | {
              kind: 'plantSort';
              parentPlantId: number;
              parentPlantName: string;
          }
        | {
              kind: 'operation';
              stages: CommunityOperationSuggestionStage[];
          }
    );

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

function errorMessage(value: unknown) {
    if (
        typeof value === 'object' &&
        value !== null &&
        'message' in value &&
        typeof value.message === 'string'
    ) {
        return value.message;
    }
    if (value instanceof Error) {
        return value.message;
    }
    return 'Slanje prijedloga nije uspjelo.';
}

function isSubmitResponse(value: unknown): value is { requestId: number } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'requestId' in value &&
        typeof value.requestId === 'number'
    );
}

function suggestionReturnPath(contextKey: string, fallbackPath: string) {
    const url =
        typeof window === 'undefined'
            ? new URL(fallbackPath, 'https://www.gredice.com')
            : new URL(window.location.href);
    url.searchParams.set(communitySuggestionParam, contextKey);
    return `${url.pathname}${url.search}${url.hash}`;
}

function consumeSuggestionReturn(contextKey: string) {
    if (typeof window === 'undefined') {
        return false;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get(communitySuggestionParam) !== contextKey) {
        return false;
    }
    url.searchParams.delete(communitySuggestionParam);
    window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
    );
    return true;
}

export function CommunityEntitySuggestionButton(
    props: CommunityEntitySuggestionButtonProps,
) {
    const [open, setOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState('');
    const [note, setNote] = useState('');
    const [plantStageId, setPlantStageId] = useState('');
    const [application, setApplication] =
        useState<OperationApplication>('plant');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successRequestId, setSuccessRequestId] = useState<number | null>(
        null,
    );
    const fieldIdPrefix = useId();
    const { data: user, isLoading: isLoadingUser } = useCurrentUser();
    const contextKey =
        props.kind === 'plantSort'
            ? `plantSort:${props.parentPlantId}`
            : 'operation';
    const returnTo = useMemo(
        () => suggestionReturnPath(contextKey, props.publicPath),
        [contextKey, props.publicPath],
    );

    const labels =
        props.kind === 'plantSort'
            ? {
                  trigger: 'Predloži novu sortu',
                  title: 'Predloži novu sortu',
                  name: 'Naziv sorte',
                  description: 'Po čemu je sorta posebna?',
              }
            : {
                  trigger: 'Predloži novu radnju',
                  title: 'Predloži novu radnju',
                  name: 'Naziv radnje',
                  description: 'Što se radnjom radi?',
              };

    useEffect(() => {
        if (consumeSuggestionReturn(contextKey)) {
            setOpen(true);
            setLoginOpen(false);
        }
    }, [contextKey]);

    useEffect(() => {
        if (!open) {
            setLoginOpen(false);
        }
    }, [open]);

    function resetForm() {
        setName('');
        setDescription('');
        setSource('');
        setNote('');
        setPlantStageId('');
        setApplication('plant');
        setError(null);
        setSuccessRequestId(null);
    }

    function handleOpenChange(nextOpen: boolean) {
        if (nextOpen && successRequestId) {
            resetForm();
        }
        setOpen(nextOpen);
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

            const suggestions =
                clientAuthenticated().api.directories['community-edits'][
                    'entity-suggestions'
                ];
            const response =
                props.kind === 'plantSort'
                    ? await suggestions.$post({
                          json: {
                              kind: props.kind,
                              parentPlantId: props.parentPlantId,
                              name: trimmedName,
                              description: trimmedDescription,
                              source: source.trim() || null,
                              note: note.trim() || null,
                              publicPath: props.publicPath,
                          },
                      })
                    : await suggestions.$post({
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

            if (!response.ok) {
                const body: unknown = await response.json().catch(() => null);
                throw new Error(errorMessage(body));
            }

            const result: unknown = await response.json();
            if (!isSubmitResponse(result)) {
                throw new Error('Slanje prijedloga nije uspjelo.');
            }
            setSuccessRequestId(result.requestId);
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Modal
            className="max-w-2xl border-border/70 shadow-xl"
            onOpenChange={handleOpenChange}
            open={open}
            title={labels.title}
            trigger={
                <Button
                    className={props.className}
                    size="sm"
                    startDecorator={<Add className="size-4" />}
                    type="button"
                    variant="outlined"
                >
                    {labels.trigger}
                </Button>
            }
        >
            <Stack spacing={5}>
                <Row spacing={2} className="items-start justify-between gap-4">
                    <Stack spacing={1}>
                        <Typography level="h3">{labels.title}</Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Prijedlog ide na administratorski pregled prije
                            stvaranja novog zapisa.
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
                    <Stack
                        spacing={3}
                        className="rounded-lg border border-border/70 bg-muted/30 p-4"
                    >
                        <Typography level="body2">
                            Za slanje prijedloga treba se prijaviti.
                        </Typography>
                        <Button
                            onClick={() => setLoginOpen(true)}
                            type="button"
                            variant="outlined"
                        >
                            Prijavi se i nastavi
                        </Button>
                        <InlineLoginDialog
                            description="Prijavi se za slanje prijedloga i nastavi ispunjavati obrazac."
                            onAuthenticated={() => {
                                setLoginOpen(false);
                                setOpen(true);
                            }}
                            onOpenChange={setLoginOpen}
                            open={loginOpen}
                            returnTo={returnTo}
                        />
                    </Stack>
                ) : successRequestId ? (
                    <Stack
                        spacing={2}
                        className="rounded-lg border border-green-700/20 bg-green-700/10 p-4"
                    >
                        <Typography>
                            Prijedlog #{successRequestId} je poslan na pregled.
                        </Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Hvala ti. Novi zapis neće biti javno dostupan bez
                            administratorske obrade i objave.
                        </Typography>
                    </Stack>
                ) : (
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        {props.kind === 'plantSort' ? (
                            <Typography
                                level="body2"
                                className="rounded-lg border border-border/70 bg-muted/30 p-3"
                            >
                                Biljka: {props.parentPlantName}
                            </Typography>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label
                                    className="space-y-1"
                                    htmlFor={`${fieldIdPrefix}-stage`}
                                >
                                    <Typography level="body2" semiBold>
                                        Stadij biljke
                                    </Typography>
                                    <select
                                        className={selectControlClassName}
                                        id={`${fieldIdPrefix}-stage`}
                                        onChange={(event) =>
                                            setPlantStageId(
                                                event.currentTarget.value,
                                            )
                                        }
                                        required
                                        value={plantStageId}
                                    >
                                        <option value="">Odaberi stadij</option>
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
                                    className="space-y-1"
                                    htmlFor={`${fieldIdPrefix}-application`}
                                >
                                    <Typography level="body2" semiBold>
                                        Primjena
                                    </Typography>
                                    <select
                                        className={selectControlClassName}
                                        id={`${fieldIdPrefix}-application`}
                                        onChange={(event) => {
                                            const nextApplication =
                                                event.currentTarget.value;
                                            if (
                                                isOperationApplication(
                                                    nextApplication,
                                                )
                                            ) {
                                                setApplication(nextApplication);
                                            }
                                        }}
                                        value={application}
                                    >
                                        {applicationOptions.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        )}

                        <Input
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
                            className="space-y-1"
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
                                    setDescription(event.currentTarget.value)
                                }
                                required
                                value={description}
                            />
                        </label>
                        <Input
                            fullWidth
                            label="Izvor ili poveznica (opcionalno)"
                            maxLength={500}
                            onChange={(event) =>
                                setSource(event.currentTarget.value)
                            }
                            value={source}
                        />
                        <label
                            className="space-y-1"
                            htmlFor={`${fieldIdPrefix}-note`}
                        >
                            <Typography level="body2">
                                Napomena za administratora (opcionalno)
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
                            <Typography level="body2" className="text-red-700">
                                {error}
                            </Typography>
                        ) : null}

                        <Row justifyContent="end">
                            <Button
                                disabled={isSubmitting}
                                endDecorator={<Send className="size-4" />}
                                type="submit"
                            >
                                {isSubmitting ? 'Šaljem...' : 'Pošalji'}
                            </Button>
                        </Row>
                    </form>
                )}
            </Stack>
        </Modal>
    );
}
