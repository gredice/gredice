'use client';

import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import {
    hasSurveyContactValue,
    type SurveyAnswerState,
    type SurveyAnswerValue,
    SurveyQuestionnaire,
    type SurveyQuestionnaireQuestion,
    SurveyStateCard,
} from '@gredice/ui/SurveyQuestionnaire';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useMemo, useState } from 'react';

type SurveyRuntime = {
    assignment: {
        expiresAt: string | null;
        id: string;
        status: 'pending' | 'started' | 'submitted' | 'expired' | 'canceled';
    };
    questions: SurveyQuestionnaireQuestion[];
    response: { id: string } | null;
    survey: {
        key: string;
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

function assignmentUrl(assignmentId: string) {
    return `/api/gredice/api/surveys/assignments/${encodeURIComponent(
        assignmentId,
    )}`;
}

async function readJson<T>(response: Response) {
    return (await response.json()) as T;
}

function isLegacyDeliveryContactQuestion(
    surveyKey: string,
    question: SurveyQuestionnaireQuestion,
) {
    return (
        surveyKey === 'delivery_satisfaction' &&
        question.type === 'contact_info' &&
        question.key === 'contact_info'
    );
}

export function SurveyResponseClient({
    assignmentId,
}: {
    assignmentId: string;
}) {
    const [runtime, setRuntime] = useState<SurveyRuntime | null>(null);
    const [answers, setAnswers] = useState<SurveyAnswerState>({});
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

    const questions = useMemo(() => {
        if (!runtime) return [];
        return runtime.questions
            .filter(
                (question) =>
                    !isLegacyDeliveryContactQuestion(
                        runtime.survey.key,
                        question,
                    ),
            )
            .slice()
            .sort((left, right) => left.sortOrder - right.sortOrder);
    }, [runtime]);

    function setAnswer(questionId: string, value: SurveyAnswerValue) {
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
                    value:
                        question.type === 'contact_info' &&
                        !hasSurveyContactValue(answers[question.id])
                            ? null
                            : (answers[question.id] ?? null),
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
                backHref="/"
                backLabel="Natrag u vrt"
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
                backHref="/"
                backLabel="Natrag u vrt"
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
                backHref="/"
                backLabel="Natrag u vrt"
                title="Anketa više nije aktivna"
                description="Ova poveznica je istekla ili više nije dostupna."
            />
        );
    }

    return (
        <SurveyQuestionnaire
            answers={answers}
            error={error}
            fieldErrors={fieldErrors}
            introDescription={runtime.version.introDescription}
            introTitle={runtime.version.introTitle}
            questions={runtime.questions}
            submitting={submitting}
            surveyKey={runtime.survey.key}
            title={runtime.version.title}
            onAnswerChange={setAnswer}
            onSubmit={handleSubmit}
        />
    );
}
