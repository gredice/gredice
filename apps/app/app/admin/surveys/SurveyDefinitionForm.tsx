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
} from './actions';

type QuestionType = 'opinion_scale' | 'long_text' | 'contact_info';

type QuestionState = {
    id: string;
    key: string;
    title: string;
    description: string;
    type: QuestionType;
    required: boolean;
    min: number;
    max: number;
    maxLength: number;
    internalScore: boolean;
    publicScore: boolean;
    contactFirstName: boolean;
    contactLastName: boolean;
    contactPhone: boolean;
    contactEmail: boolean;
};

const initialQuestion: QuestionState = {
    id: 'score-question',
    key: 'score',
    title: 'Ocjena',
    description: '',
    type: 'opinion_scale',
    required: false,
    min: 0,
    max: 10,
    maxLength: 2000,
    internalScore: true,
    publicScore: false,
    contactFirstName: true,
    contactLastName: true,
    contactPhone: true,
    contactEmail: true,
};

function newQuestionId(type: QuestionType) {
    return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toQuestionPayload(question: QuestionState) {
    const base = {
        key: question.key,
        title: question.title,
        description: question.description || null,
        type: question.type,
        required: question.required,
        scoreMetadata:
            question.type === 'opinion_scale'
                ? {
                      internalScore: question.internalScore,
                      publicScore: question.publicScore,
                  }
                : undefined,
    };

    if (question.type === 'opinion_scale') {
        return {
            ...base,
            settings: {
                type: 'opinion_scale',
                min: question.min,
                max: question.max,
                step: 1,
            },
        };
    }

    if (question.type === 'contact_info') {
        const fields = [
            question.contactFirstName ? 'first_name' : null,
            question.contactLastName ? 'last_name' : null,
            question.contactPhone ? 'phone' : null,
            question.contactEmail ? 'email' : null,
        ].filter((field): field is string => Boolean(field));

        return {
            ...base,
            settings: {
                type: 'contact_info',
                fields,
                phoneDefaultCountry: 'HR',
            },
        };
    }

    return {
        ...base,
        settings: {
            type: 'long_text',
            maxLength: question.maxLength,
        },
    };
}

function nextQuestion(type: QuestionType): QuestionState {
    if (type === 'long_text') {
        return {
            ...initialQuestion,
            id: newQuestionId(type),
            key: `text_${Date.now()}`,
            title: 'Tekstualni odgovor',
            type,
            internalScore: false,
        };
    }
    if (type === 'contact_info') {
        return {
            ...initialQuestion,
            id: newQuestionId(type),
            key: `contact_${Date.now()}`,
            title: 'Kontakt podaci',
            type,
            internalScore: false,
        };
    }
    return {
        ...initialQuestion,
        id: newQuestionId(type),
        key: `score_${Date.now()}`,
        title: 'Ocjena',
        type,
    };
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

function TextAreaField({
    defaultValue = '',
    label,
    name,
}: {
    defaultValue?: string;
    label: string;
    name: string;
}) {
    return (
        <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">
                {label}
            </span>
            <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                defaultValue={defaultValue}
                name={name}
            />
        </label>
    );
}

function questionTypeFromValue(value: string): QuestionType {
    if (value === 'long_text' || value === 'contact_info') {
        return value;
    }
    return 'opinion_scale';
}

export function SurveyDefinitionForm({
    mode = 'create',
    surveyId,
}: {
    mode?: 'create' | 'version';
    surveyId?: string;
}) {
    const [questions, setQuestions] = useState<QuestionState[]>([
        initialQuestion,
    ]);
    const [state, formAction, pending] = useActionState(
        mode === 'create'
            ? createSurveyDefinitionAction
            : createSurveyDraftVersionAction,
        {} satisfies SurveyActionState,
    );
    const questionsJson = useMemo(
        () => JSON.stringify(questions.map(toQuestionPayload)),
        [questions],
    );

    function updateQuestion(index: number, update: Partial<QuestionState>) {
        setQuestions((items) =>
            items.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...update } : item,
            ),
        );
    }

    return (
        <form action={formAction} className="space-y-4">
            {surveyId ? (
                <input name="surveyId" type="hidden" value={surveyId} />
            ) : null}
            <input name="questionsJson" type="hidden" value={questionsJson} />

            <div className="grid gap-3 md:grid-cols-2">
                {mode === 'create' ? (
                    <Input
                        fullWidth
                        label="Ključ ankete"
                        name="key"
                        placeholder="npr. delivery_satisfaction"
                        required
                    />
                ) : null}
                <Input fullWidth label="Naziv" name="title" required />
                {mode === 'create' ? (
                    <Input
                        fullWidth
                        label="Kategorija"
                        name="category"
                        defaultValue="general"
                    />
                ) : null}
                <Input
                    fullWidth
                    label="Naslov uvoda"
                    name="introTitle"
                    placeholder="Anketa zadovoljstva"
                />
                <Input
                    fullWidth
                    label="Naslov zahvale"
                    name="thankYouTitle"
                    placeholder="Hvala ti na odgovoru!"
                />
            </div>

            <TextAreaField label="Opis" name="description" />
            <TextAreaField label="Uvodni tekst" name="introDescription" />
            <TextAreaField label="Tekst zahvale" name="thankYouDescription" />

            <Stack spacing={3}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Typography level="h6">Pitanja</Typography>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            onClick={() =>
                                setQuestions((items) => [
                                    ...items,
                                    nextQuestion('opinion_scale'),
                                ])
                            }
                        >
                            Skala
                        </Button>
                        <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            onClick={() =>
                                setQuestions((items) => [
                                    ...items,
                                    nextQuestion('long_text'),
                                ])
                            }
                        >
                            Tekst
                        </Button>
                        <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            onClick={() =>
                                setQuestions((items) => [
                                    ...items,
                                    nextQuestion('contact_info'),
                                ])
                            }
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
                                        updateQuestion(index, {
                                            type: questionTypeFromValue(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                >
                                    <option value="opinion_scale">
                                        Skala 0-10
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
                                value={question.description}
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
                                        checked={question.internalScore}
                                        label="Interni skor"
                                        onCheckedChange={(checked) =>
                                            updateQuestion(index, {
                                                internalScore: checked === true,
                                            })
                                        }
                                    />
                                    <Checkbox
                                        checked={question.publicScore}
                                        label="Javni skor kasnije"
                                        onCheckedChange={(checked) =>
                                            updateQuestion(index, {
                                                publicScore: checked === true,
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
                                    value={question.min}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            min: Number.parseInt(
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
                                    value={question.max}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            max: Number.parseInt(
                                                event.target.value,
                                                10,
                                            ),
                                        })
                                    }
                                />
                            </div>
                        ) : null}

                        {question.type === 'long_text' ? (
                            <div className="mt-3">
                                <Input
                                    fullWidth
                                    label="Najveći broj znakova"
                                    type="number"
                                    value={question.maxLength}
                                    onChange={(event) =>
                                        updateQuestion(index, {
                                            maxLength: Number.parseInt(
                                                event.target.value,
                                                10,
                                            ),
                                        })
                                    }
                                />
                            </div>
                        ) : null}

                        {question.type === 'contact_info' ? (
                            <div className="mt-3 flex flex-wrap gap-4">
                                <Checkbox
                                    checked={question.contactFirstName}
                                    label="Ime"
                                    onCheckedChange={(checked) =>
                                        updateQuestion(index, {
                                            contactFirstName: checked === true,
                                        })
                                    }
                                />
                                <Checkbox
                                    checked={question.contactLastName}
                                    label="Prezime"
                                    onCheckedChange={(checked) =>
                                        updateQuestion(index, {
                                            contactLastName: checked === true,
                                        })
                                    }
                                />
                                <Checkbox
                                    checked={question.contactPhone}
                                    label="Telefon"
                                    onCheckedChange={(checked) =>
                                        updateQuestion(index, {
                                            contactPhone: checked === true,
                                        })
                                    }
                                />
                                <Checkbox
                                    checked={question.contactEmail}
                                    label="Email"
                                    onCheckedChange={(checked) =>
                                        updateQuestion(index, {
                                            contactEmail: checked === true,
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
                    : mode === 'create'
                      ? 'Spremi nacrt'
                      : 'Spremi novu verziju'}
            </Button>
        </form>
    );
}
