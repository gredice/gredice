'use client';

import type {
    SelectSurvey,
    SelectSurveyQuestion,
    SelectSurveyVersion,
} from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import {
    type SurveyAnswerState,
    type SurveyAnswerValue,
    SurveyQuestionnaire,
    SurveyStateCard,
} from '@gredice/ui/SurveyQuestionnaire';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';

export function SurveyVersionPreview({
    questions,
    survey,
    version,
}: {
    questions: SelectSurveyQuestion[];
    survey: SelectSurvey;
    version: SelectSurveyVersion;
}) {
    const [answers, setAnswers] = useState<SurveyAnswerState>({});
    const [state, setState] = useState<'questionnaire' | 'thank-you'>(
        'questionnaire',
    );

    function setAnswer(questionId: string, value: SurveyAnswerValue) {
        setAnswers((current) => ({ ...current, [questionId]: value }));
    }

    return (
        <Stack spacing={4}>
            <Alert color="info">
                <Typography level="body2">
                    Pregled je lokalna simulacija. Ne stvara dodjelu ni odgovor
                    i ne šalje obavijesti.
                </Typography>
            </Alert>
            <Row className="flex-wrap">
                <Button
                    size="sm"
                    type="button"
                    variant={state === 'questionnaire' ? 'solid' : 'outlined'}
                    onClick={() => setState('questionnaire')}
                >
                    Obrazac
                </Button>
                <Button
                    size="sm"
                    type="button"
                    variant={state === 'thank-you' ? 'solid' : 'outlined'}
                    onClick={() => setState('thank-you')}
                >
                    Zahvala
                </Button>
            </Row>
            {state === 'questionnaire' ? (
                <SurveyQuestionnaire
                    answers={answers}
                    introDescription={version.introDescription}
                    introTitle={version.introTitle}
                    questions={questions}
                    submitDisabled
                    submitLabel="Pregled — slanje isključeno"
                    surveyKey={survey.key}
                    title={version.title}
                    onAnswerChange={setAnswer}
                />
            ) : (
                <SurveyStateCard
                    description={
                        version.thankYouDescription ??
                        'Tvoj odgovor je spremljen.'
                    }
                    title={version.thankYouTitle ?? 'Hvala ti!'}
                />
            )}
        </Stack>
    );
}
