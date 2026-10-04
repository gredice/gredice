'use client';

import { Button } from '../Button';
import { Card, CardContent, CardHeader, CardTitle } from '../Card';
import { Stack } from '../Stack';
import { Typography } from '../Typography';
import { SurveyQuestionField } from './SurveyQuestionField';
import type {
    SurveyAnswerState,
    SurveyAnswerValue,
    SurveyQuestionnaireQuestion,
} from './types';

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

function visibleIntroDescription(
    description: string | null,
    hidesLegacyContactQuestion: boolean,
) {
    if (!hidesLegacyContactQuestion) return description;
    return description?.replace(', a kontakt podatke možeš preskočiti.', '.');
}

export function SurveyQuestionnaire({
    answers,
    error,
    fieldErrors = {},
    introDescription,
    introTitle,
    onAnswerChange,
    onSubmit,
    questions,
    submitDisabled,
    submitLabel = 'Pošalji odgovor',
    submitting,
    surveyKey,
    title,
}: {
    answers: SurveyAnswerState;
    error?: string | null;
    fieldErrors?: Record<string, string>;
    introDescription: string | null;
    introTitle: string | null;
    onAnswerChange: (questionId: string, value: SurveyAnswerValue) => void;
    onSubmit?: () => void;
    questions: SurveyQuestionnaireQuestion[];
    submitDisabled?: boolean;
    submitLabel?: string;
    submitting?: boolean;
    surveyKey: string;
    title: string;
}) {
    const visibleQuestions = questions
        .filter(
            (question) => !isLegacyDeliveryContactQuestion(surveyKey, question),
        )
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder);
    const description = visibleIntroDescription(
        introDescription,
        visibleQuestions.length !== questions.length,
    );

    return (
        <Card className="mx-auto max-w-2xl bg-background">
            <CardHeader>
                <Stack spacing={2}>
                    <Typography level="body3" className="text-muted-foreground">
                        Gredice anketa
                    </Typography>
                    <CardTitle>{introTitle ?? title}</CardTitle>
                    {description ? (
                        <Typography className="text-muted-foreground">
                            {description}
                        </Typography>
                    ) : null}
                </Stack>
            </CardHeader>
            <CardContent>
                <Stack spacing={5}>
                    {visibleQuestions.map((question, index) => (
                        <SurveyQuestionField
                            answer={answers[question.id]}
                            error={
                                fieldErrors[question.key] ??
                                fieldErrors[question.id]
                            }
                            index={index}
                            key={question.id}
                            question={question}
                            onAnswerChange={(value) =>
                                onAnswerChange(question.id, value)
                            }
                        />
                    ))}

                    {error ? (
                        <Typography className="text-red-700">
                            {error}
                        </Typography>
                    ) : null}

                    <Button
                        type="button"
                        disabled={submitDisabled || submitting}
                        fullWidth
                        loading={submitting}
                        onClick={onSubmit}
                    >
                        {submitLabel}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}
