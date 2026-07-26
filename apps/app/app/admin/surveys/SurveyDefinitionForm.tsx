'use client';

import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useActionState, useMemo, useState } from 'react';
import {
    createSurveyDefinitionAction,
    createSurveyDraftVersionAction,
    type SurveyActionState,
    updateSurveyDraftVersionAction,
} from './actions';
import { SurveyTextAreaField } from './SurveyTextAreaField';
import {
    createSurveyQuestionFormState,
    emptySurveyDefinitionFormValues,
    type SurveyDefinitionFormValues,
    type SurveyQuestionFormState,
    setSurveyContactField,
    surveyQuestionFromFormState,
} from './surveyDefinitionFormModel';

type SurveyDefinitionFormMode =
    | 'create-survey'
    | 'create-version'
    | 'edit-draft';

function newQuestionId(type: SurveyQuestionFormState['type']) {
    return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function questionTypeFromValue(value: string): SurveyQuestionFormState['type'] {
    if (value === 'long_text' || value === 'contact_info') {
        return value;
    }
    return 'opinion_scale';
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return items;
    const current = next[index];
    const replacement = next[target];
    if (current === undefined || replacement === undefined) return items;
    next[index] = replacement;
    next[target] = current;
    return next;
}

function numericInputValue(value: number | undefined) {
    return value ?? '';
}

function optionalInteger(value: string) {
    return value.trim() ? Number.parseInt(value, 10) : undefined;
}

function actionForMode(mode: SurveyDefinitionFormMode) {
    if (mode === 'create-survey') {
        return createSurveyDefinitionAction;
    }
    if (mode === 'edit-draft') {
        return updateSurveyDraftVersionAction;
    }
    return createSurveyDraftVersionAction;
}

export function SurveyDefinitionForm({
    initialValues,
    mode = 'create-survey',
    sourceVersionId,
    surveyId,
    versionId,
}: {
    initialValues?: SurveyDefinitionFormValues;
    mode?: SurveyDefinitionFormMode;
    sourceVersionId?: string;
    surveyId?: string;
    versionId?: string;
}) {
    const values = initialValues ?? emptySurveyDefinitionFormValues();
    const [questions, setQuestions] = useState<SurveyQuestionFormState[]>(() =>
        values.questions.map((question) => ({ ...question })),
    );
    const [state, formAction, pending] = useActionState(
        actionForMode(mode),
        {} satisfies SurveyActionState,
    );
    const questionsJson = useMemo(
        () =>
            JSON.stringify(
                questions.map((question) =>
                    surveyQuestionFromFormState(question),
                ),
            ),
        [questions],
    );

    function updateQuestion(
        index: number,
        update: Partial<SurveyQuestionFormState>,
    ) {
        setQuestions((items) =>
            items.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...update } : item,
            ),
        );
    }

    function addQuestion(type: SurveyQuestionFormState['type']) {
        const id = newQuestionId(type);
        setQuestions((items) => [
            ...items,
            createSurveyQuestionFormState(type, id, id),
        ]);
    }

    function changeQuestionType(
        index: number,
        type: SurveyQuestionFormState['type'],
    ) {
        setQuestions((items) =>
            items.map((question, itemIndex) => {
                if (itemIndex !== index || question.type === type) {
                    return question;
                }
                const defaults = createSurveyQuestionFormState(
                    type,
                    question.id,
                    question.key,
                );
                return {
                    ...question,
                    type,
                    opinionMin: question.opinionMin ?? defaults.opinionMin,
                    opinionMax: question.opinionMax ?? defaults.opinionMax,
                    opinionStep: question.opinionStep ?? defaults.opinionStep,
                    longTextMaxLength:
                        question.longTextMaxLength ??
                        defaults.longTextMaxLength,
                    contactFields:
                        question.contactFields.length > 0
                            ? question.contactFields
                            : defaults.contactFields,
                    contactPhoneDefaultCountry:
                        question.contactPhoneDefaultCountry ??
                        defaults.contactPhoneDefaultCountry,
                    scoreMetadata:
                        type === 'opinion_scale'
                            ? (question.scoreMetadata ?? defaults.scoreMetadata)
                            : question.scoreMetadata,
                };
            }),
        );
    }

    return (
        <form action={formAction} className="space-y-4">
            {surveyId ? (
                <input name="surveyId" type="hidden" value={surveyId} />
            ) : null}
            {versionId ? (
                <input name="versionId" type="hidden" value={versionId} />
            ) : null}
            {sourceVersionId ? (
                <input
                    name="sourceVersionId"
                    type="hidden"
                    value={sourceVersionId}
                />
            ) : null}
            <input name="questionsJson" type="hidden" value={questionsJson} />

            <div className="grid gap-3 md:grid-cols-2">
                {mode === 'create-survey' ? (
                    <Input
                        defaultValue={values.key}
                        fullWidth
                        label="Ključ ankete"
                        name="key"
                        placeholder="npr. delivery_satisfaction"
                        required
                    />
                ) : null}
                <Input
                    defaultValue={values.title}
                    fullWidth
                    label="Naziv"
                    name="title"
                    required
                />
                {mode === 'create-survey' ? (
                    <Input
                        defaultValue={values.category}
                        fullWidth
                        label="Kategorija"
                        name="category"
                    />
                ) : null}
                <Input
                    defaultValue={values.introTitle}
                    fullWidth
                    label="Naslov uvoda"
                    name="introTitle"
                    placeholder="Anketa zadovoljstva"
                />
                <Input
                    defaultValue={values.thankYouTitle}
                    fullWidth
                    label="Naslov zahvale"
                    name="thankYouTitle"
                    placeholder="Hvala ti na odgovoru!"
                />
            </div>

            <SurveyTextAreaField
                defaultValue={values.description}
                label="Opis"
                name="description"
            />
            <SurveyTextAreaField
                defaultValue={values.introDescription}
                label="Uvodni tekst"
                name="introDescription"
            />
            <SurveyTextAreaField
                defaultValue={values.thankYouDescription}
                label="Tekst zahvale"
                name="thankYouDescription"
            />

            <Stack spacing={3}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Typography level="h6">Pitanja</Typography>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            onClick={() => addQuestion('opinion_scale')}
                        >
                            Skala
                        </Button>
                        <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            onClick={() => addQuestion('long_text')}
                        >
                            Tekst
                        </Button>
                        <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            onClick={() => addQuestion('contact_info')}
                        >
                            Kontakt
                        </Button>
                    </div>
                </div>

                {questions.map((question, index) => (
                    <div
                        className="rounded-md border bg-background p-3"
                        key={question.id}
                    >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <Typography semiBold>
                                {index + 1}. {question.title || 'Pitanje'}
                            </Typography>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="xs"
                                    variant="outlined"
                                    disabled={index === 0}
                                    onClick={() =>
                                        setQuestions((items) =>
                                            moveItem(items, index, -1),
                                        )
                                    }
                                >
                                    Gore
                                </Button>
                                <Button
                                    type="button"
                                    size="xs"
                                    variant="outlined"
                                    disabled={index === questions.length - 1}
                                    onClick={() =>
                                        setQuestions((items) =>
                                            moveItem(items, index, 1),
                                        )
                                    }
                                >
                                    Dolje
                                </Button>
                                <Button
                                    type="button"
                                    size="xs"
                                    variant="plain"
                                    color="danger"
                                    disabled={questions.length === 1}
                                    onClick={() =>
                                        setQuestions((items) =>
                                            items.filter(
                                                (_item, itemIndex) =>
                                                    itemIndex !== index,
                                            ),
                                        )
                                    }
                                >
                                    Ukloni
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <Input
                                fullWidth
                                label="Ključ pitanja"
                                value={question.key}
                                onChange={(event) =>
                                    updateQuestion(index, {
                                        key: event.target.value,
                                    })
                                }
                            />
                            <label className="space-y-1">
                                <span className="block text-sm font-medium text-foreground">
                                    Tip
                                </span>
                                <select
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                                    value={question.type}
                                    onChange={(event) =>
                                        changeQuestionType(
                                            index,
                                            questionTypeFromValue(
                                                event.target.value,
                                            ),
                                        )
                                    }
                                >
                                    <option value="opinion_scale">
                                        Brojčana skala
                                    </option>
                                    <option value="long_text">
                                        Dugi tekst
                                    </option>
                                    <option value="contact_info">
                                        Kontakt podaci
                                    </option>
                                </select>
                            </label>
                            <Input
                                fullWidth
                                label="Naslov pitanja"
                                value={question.title}
                                onChange={(event) =>
                                    updateQuestion(index, {
                                        title: event.target.value,
                                    })
                                }
                            />
                            <Input
                                fullWidth
                                label="Opis pitanja"
                                value={question.description ?? ''}
                                onChange={(event) =>
                                    updateQuestion(index, {
                                        description: event.target.value,
                                    })
                                }
                            />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-4">
                            <Checkbox
                                checked={question.required}
                                label="Obavezno"
                                onCheckedChange={(checked) =>
                                    updateQuestion(index, {
                                        required: checked === true,
                                    })
                                }
                            />
                            {question.type === 'opinion_scale' ? (
                                <>
                                    <Checkbox
                                        checked={
                                            question.scoreMetadata
                                                ?.internalScore ?? false
                                        }
                                        label="Interni skor"
                                        onCheckedChange={(checked) =>
                                            updateQuestion(index, {
                                                scoreMetadata: {
                                                    ...question.scoreMetadata,
                                                    internalScore:
                                                        checked === true,
                                                },
                                            })
                                        }
                                    />
                                    <Checkbox
                                        checked={
                                            question.scoreMetadata
                                                ?.publicScore ?? false
                                        }
                                        label="Javni skor"
                                        onCheckedChange={(checked) =>
                                            updateQuestion(index, {
                                                scoreMetadata: {
                                                    ...question.scoreMetadata,
                                                    publicScore:
                                                        checked === true,
                                                },
                                            })
                                        }
                                    />
                                    <Checkbox
                                        checked={
                                            question.scoreMetadata?.npsLike ??
                                            false
                                        }
                                        label="NPS način"
                                        onCheckedChange={(checked) =>
                                            updateQuestion(index, {
                                                scoreMetadata: {
                                                    ...question.scoreMetadata,
                                                    npsLike: checked === true,
                                                },
                                            })
                                        }
                                    />
                                </>
                            ) : null}
                        </div>

                        {question.type === 'opinion_scale' ? (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <Input
                                    fullWidth
                                    label="Minimum"
                                    type="number"
                                    value={question.opinionMin}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            opinionMin: Number.parseInt(
                                                event.target.value,
                                                10,
                                            ),
                                        })
                                    }
                                />
                                <Input
                                    fullWidth
                                    label="Maximum"
                                    type="number"
                                    value={question.opinionMax}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            opinionMax: Number.parseInt(
                                                event.target.value,
                                                10,
                                            ),
                                        })
                                    }
                                />
                                <Input
                                    fullWidth
                                    label="Korak"
                                    type="number"
                                    value={numericInputValue(
                                        question.opinionStep,
                                    )}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            opinionStep: optionalInteger(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                />
                                <Input
                                    fullWidth
                                    label="Oznaka minimuma"
                                    value={question.opinionMinLabel ?? ''}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            opinionMinLabel: event.target.value,
                                        })
                                    }
                                />
                                <Input
                                    fullWidth
                                    label="Oznaka maksimuma"
                                    value={question.opinionMaxLabel ?? ''}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            opinionMaxLabel: event.target.value,
                                        })
                                    }
                                />
                            </div>
                        ) : null}

                        {question.type === 'long_text' ? (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <Input
                                    fullWidth
                                    label="Najveći broj znakova"
                                    type="number"
                                    value={numericInputValue(
                                        question.longTextMaxLength,
                                    )}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            longTextMaxLength: optionalInteger(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                />
                                <Input
                                    fullWidth
                                    label="Tekst u praznom polju"
                                    value={question.longTextPlaceholder ?? ''}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            longTextPlaceholder:
                                                event.target.value,
                                        })
                                    }
                                />
                            </div>
                        ) : null}

                        {question.type === 'contact_info' ? (
                            <div className="mt-3 space-y-3">
                                <div className="flex flex-wrap gap-4">
                                    {(
                                        [
                                            ['first_name', 'Ime'],
                                            ['last_name', 'Prezime'],
                                            ['phone', 'Telefon'],
                                            ['email', 'Email'],
                                        ] as const
                                    ).map(([field, label]) => (
                                        <Checkbox
                                            key={field}
                                            checked={question.contactFields.includes(
                                                field,
                                            )}
                                            label={label}
                                            onCheckedChange={(checked) =>
                                                setQuestions((items) =>
                                                    items.map(
                                                        (item, itemIndex) =>
                                                            itemIndex === index
                                                                ? setSurveyContactField(
                                                                      item,
                                                                      field,
                                                                      checked ===
                                                                          true,
                                                                  )
                                                                : item,
                                                    ),
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                                <Input
                                    fullWidth
                                    label="Zadana država telefona"
                                    value={
                                        question.contactPhoneDefaultCountry ??
                                        ''
                                    }
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            contactPhoneDefaultCountry:
                                                event.target.value,
                                        })
                                    }
                                />
                            </div>
                        ) : null}
                    </div>
                ))}
            </Stack>

            {state.message ? (
                <Typography
                    className={
                        state.success ? 'text-green-700' : 'text-red-700'
                    }
                >
                    {state.message}
                </Typography>
            ) : null}

            <Button type="submit" disabled={pending}>
                {pending
                    ? 'Spremanje...'
                    : mode === 'create-survey'
                      ? 'Spremi nacrt'
                      : mode === 'edit-draft'
                        ? 'Spremi promjene nacrta'
                        : 'Spremi novu verziju'}
            </Button>
        </form>
    );
}
