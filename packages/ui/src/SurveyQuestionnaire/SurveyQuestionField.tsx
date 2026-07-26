import { Typography } from '../Typography';
import { SurveyContactFields } from './SurveyContactFields';
import { SurveyOpinionScale } from './SurveyOpinionScale';
import {
    isSurveyContactValue,
    type SurveyAnswerValue,
    type SurveyQuestionnaireQuestion,
} from './types';

export function SurveyQuestionField({
    answer,
    error,
    index,
    onAnswerChange,
    question,
}: {
    answer: SurveyAnswerValue;
    error?: string;
    index: number;
    onAnswerChange: (value: SurveyAnswerValue) => void;
    question: SurveyQuestionnaireQuestion;
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
                <SurveyOpinionScale
                    max={question.settings.max}
                    maxLabel={question.settings.maxLabel}
                    min={question.settings.min}
                    minLabel={question.settings.minLabel}
                    step={question.settings.step}
                    value={typeof answer === 'number' ? answer : undefined}
                    onChange={onAnswerChange}
                />
            ) : null}

            {question.type === 'long_text' &&
            question.settings.type === 'long_text' ? (
                <textarea
                    className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                    maxLength={question.settings.maxLength}
                    placeholder={question.settings.placeholder ?? undefined}
                    value={typeof answer === 'string' ? answer : ''}
                    onChange={(event) => onAnswerChange(event.target.value)}
                />
            ) : null}

            {question.type === 'contact_info' &&
            question.settings.type === 'contact_info' ? (
                <SurveyContactFields
                    fields={question.settings.fields}
                    value={isSurveyContactValue(answer) ? answer : {}}
                    onChange={onAnswerChange}
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
