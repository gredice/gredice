'use client';

import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useMemo, useState } from 'react';

type QuestionSettings =
    | {
          max: number;
          min: number;
          step?: number;
          type: 'opinion_scale';
      }
    | {
          maxLength?: number;
          placeholder?: string | null;
          type: 'long_text';
      }
    | {
          fields: Array<'first_name' | 'last_name' | 'phone' | 'email'>;
          phoneDefaultCountry?: string | null;
          type: 'contact_info';
      };

type SurveyQuestion = {
    description: string | null;
    id: string;
    key: string;
    required: boolean;
    settings: QuestionSettings;
    sortOrder: number;
    title: string;
    type: 'opinion_scale' | 'long_text' | 'contact_info';
};

type SurveyRuntime = {
    assignment: {
        expiresAt: string | null;
        id: string;
        status: 'pending' | 'started' | 'submitted' | 'expired' | 'canceled';
    };
    questions: SurveyQuestion[];
    response: { id: string } | null;
    survey: {
        title: string;
    };
    version: {
        introDescription: string | null;
        introTitle: string | null;
        thankYouDescription: string | null;
        thankYouTitle: string | null;
        title: string;
    };
};

type AnswerState = Record<string, number | string | undefined>;

function assignmentUrl(assignmentId: string) {
    return `/api/gredice/api/surveys/assignments/${encodeURIComponent(
        assignmentId,
    )}`;
}

async function readJson<T>(response: Response) {
    return (await response.json()) as T;
}

function visibleIntroDescription(description: string | null) {
    return description?.replace(', a kontakt podatke možeš preskočiti.', '.');
}

export function SurveyResponseClient({
    assignmentId,
}: {
    assignmentId: string;
}) {
    const [runtime, setRuntime] = useState<SurveyRuntime | null>(null);
    const [answers, setAnswers] = useState<AnswerState>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        let canceled = false;

        async function loadSurvey() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(assignmentUrl(assignmentId), {
                    cache: 'no-store',
                    credentials: 'include',
                });
                if (!response.ok) {
                    throw new Error('Anketa nije dostupna.');
                }
                const nextRuntime = await readJson<SurveyRuntime>(response);
                if (canceled) return;
                setRuntime(nextRuntime);
                if (nextRuntime.assignment.status === 'pending') {
                    await fetch(`${assignmentUrl(assignmentId)}/start`, {
                        credentials: 'include',
                        method: 'POST',
                    });
                }
            } catch (loadError) {
                if (!canceled) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : 'Anketu nije moguće učitati.',
                    );
                }
            } finally {
                if (!canceled) {
                    setLoading(false);
                }
            }
        }

        void loadSurvey();

        return () => {
            canceled = true;
        };
    }, [assignmentId]);

    const questions = useMemo(
        () =>
            runtime?.questions
                .filter((question) => question.type !== 'contact_info')
                .slice()
                .sort((left, right) => left.sortOrder - right.sortOrder) ?? [],
        [runtime?.questions],
    );

    function setAnswer(questionId: string, value: AnswerState[string]) {
        setAnswers((current) => ({ ...current, [questionId]: value }));
        setFieldErrors((current) => {
            const next = { ...current };
            delete next[questionId];
            return next;
        });
    }

    async function handleSubmit() {
        if (!runtime) return;
        setSubmitting(true);
        setError(null);
        setFieldErrors({});
        try {
            const payload = {
                answers: questions.map((question) => ({
                    questionId: question.id,
                    questionKey: question.key,
                    value: answers[question.id] ?? null,
                })),
                metadata: {
                    submittedFrom: 'garden_survey_route',
                },
            };
            const response = await fetch(
                `${assignmentUrl(assignmentId)}/submit`,
                {
                    body: JSON.stringify(payload),
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
            );
            const result = await readJson<{
                fieldErrors?: Record<string, string>;
                message?: string;
                ok?: boolean;
            }>(response);
            if (!response.ok || result.ok === false) {
                setFieldErrors(result.fieldErrors ?? {});
                throw new Error(result.message ?? 'Provjeri odgovore.');
            }
            setSubmitted(true);
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : 'Odgovor nije moguće poslati.',
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-lg items-center justify-center">
                <Row spacing={3} className="items-center">
                    <Spinner loading loadingLabel="Učitavanje ankete" />
                    <Typography>Učitavanje ankete...</Typography>
                </Row>
            </div>
        );
    }

    if (error && !runtime) {
        return (
            <SurveyStateCard
                title="Anketa nije dostupna"
                description="Provjeri poveznicu ili otvori anketu iz obavijesti u svom Gredice računu."
            />
        );
    }

    if (!runtime) {
        return null;
    }

    if (
        submitted ||
        runtime.response ||
        runtime.assignment.status === 'submitted'
    ) {
        return (
            <SurveyStateCard
                title={runtime.version.thankYouTitle ?? 'Hvala ti!'}
                description={
                    runtime.version.thankYouDescription ??
                    'Tvoj odgovor je spremljen.'
                }
            />
        );
    }

    if (
        runtime.assignment.status === 'expired' ||
        runtime.assignment.status === 'canceled'
    ) {
        return (
            <SurveyStateCard
                title="Anketa više nije aktivna"
                description="Ova poveznica je istekla ili više nije dostupna."
            />
        );
    }

    const introDescription = visibleIntroDescription(
        runtime.version.introDescription,
    );

    return (
        <Card className="mx-auto max-w-2xl bg-background">
            <CardHeader>
                <Stack spacing={2}>
                    <Typography level="body3" className="text-muted-foreground">
                        Gredice anketa
                    </Typography>
                    <CardTitle>
                        {runtime.version.introTitle ?? runtime.version.title}
                    </CardTitle>
                    {introDescription ? (
                        <Typography className="text-muted-foreground">
                            {introDescription}
                        </Typography>
                    ) : null}
                </Stack>
            </CardHeader>
            <CardContent>
                <Stack spacing={5}>
                    {questions.map((question, index) => (
                        <QuestionBlock
                            answer={answers[question.id]}
                            error={
                                fieldErrors[question.key] ??
                                fieldErrors[question.id]
                            }
                            index={index}
                            key={question.id}
                            question={question}
                            setAnswer={(value) => setAnswer(question.id, value)}
                        />
                    ))}

                    {error ? (
                        <Typography className="text-red-700">
                            {error}
                        </Typography>
                    ) : null}

                    <Button
                        type="button"
                        fullWidth
                        loading={submitting}
                        disabled={submitting}
                        onClick={handleSubmit}
                    >
                        Pošalji odgovor
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}

function SurveyStateCard({
    description,
    title,
}: {
    description: string;
    title: string;
}) {
    return (
        <Card className="mx-auto max-w-lg bg-background">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <Stack spacing={4}>
                    <Typography className="text-muted-foreground">
                        {description}
                    </Typography>
                    <Button href="/" variant="outlined">
                        Natrag u vrt
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}

function QuestionBlock({
    answer,
    error,
    index,
    question,
    setAnswer,
}: {
    answer: AnswerState[string];
    error?: string;
    index: number;
    question: SurveyQuestion;
    setAnswer: (value: AnswerState[string]) => void;
}) {
    return (
        <fieldset className="space-y-3">
            <legend className="min-w-0">
                <Typography level="h6">
                    {index + 1}. {question.title}
                    {question.required ? ' *' : ''}
                </Typography>
            </legend>
            {question.description ? (
                <Typography level="body2" className="text-muted-foreground">
                    {question.description}
                </Typography>
            ) : null}

            {question.type === 'opinion_scale' &&
            question.settings.type === 'opinion_scale' ? (
                <OpinionScale
                    max={question.settings.max}
                    min={question.settings.min}
                    value={typeof answer === 'number' ? answer : undefined}
                    onChange={setAnswer}
                />
            ) : null}

            {question.type === 'long_text' ? (
                <textarea
                    className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                    maxLength={
                        question.settings.type === 'long_text'
                            ? question.settings.maxLength
                            : undefined
                    }
                    placeholder={
                        question.settings.type === 'long_text'
                            ? (question.settings.placeholder ?? undefined)
                            : undefined
                    }
                    value={typeof answer === 'string' ? answer : ''}
                    onChange={(event) => setAnswer(event.target.value)}
                />
            ) : null}

            {error ? (
                <Typography level="body2" className="text-red-700">
                    {error}
                </Typography>
            ) : null}
        </fieldset>
    );
}

function OpinionScale({
    max,
    min,
    onChange,
    value,
}: {
    max: number;
    min: number;
    onChange: (value: number) => void;
    value?: number;
}) {
    const values = [];
    for (let current = min; current <= max; current += 1) {
        values.push(current);
    }

    return (
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
            {values.map((item) => (
                <button
                    aria-pressed={value === item}
                    className={
                        value === item
                            ? 'h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold'
                            : 'h-11 rounded-md border bg-background text-sm font-semibold hover:bg-muted'
                    }
                    key={item}
                    type="button"
                    onClick={() => onChange(item)}
                >
                    {item}
                </button>
            ))}
        </div>
    );
}
