import type {
    SelectSurvey,
    SelectSurveyQuestion,
    SelectSurveyVersion,
} from '@gredice/storage';
import { expect, test } from '@playwright/experimental-ct-react';
import { SurveyVersionPreview } from '../app/admin/surveys/SurveyVersionPreview';

const timestamp = new Date('2026-07-26T08:00:00.000Z');

const survey = {
    id: 'survey-preview',
    key: 'survey_preview',
    title: 'Anketa za pregled',
    description: 'Opis',
    category: 'general',
    status: 'draft',
    activeVersionId: null,
    metadata: {},
    createdByUserId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
} satisfies SelectSurvey;

const version = {
    id: 'version-preview',
    surveyId: survey.id,
    versionNumber: 2,
    status: 'draft',
    title: 'Pregled ankete',
    description: null,
    introTitle: 'Dobro došli',
    introDescription: 'Ispunite kratku anketu.',
    thankYouTitle: 'Hvala!',
    thankYouDescription: 'Pregled završnog stanja.',
    metadata: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: null,
    archivedAt: null,
} satisfies SelectSurveyVersion;

const questions = [
    {
        id: 'question-score',
        versionId: version.id,
        key: 'score',
        title: 'Ocjena',
        description: null,
        type: 'opinion_scale',
        sortOrder: 1,
        required: true,
        settings: {
            type: 'opinion_scale',
            min: 1,
            max: 5,
            step: 2,
            minLabel: 'Loše',
            maxLabel: 'Odlično',
        },
        scoreMetadata: {
            internalScore: true,
            npsLike: false,
            publicScore: false,
        },
        createdAt: timestamp,
    },
] satisfies SelectSurveyQuestion[];

test('previews questionnaire and thank-you states without a submit path', async ({
    mount,
}) => {
    const component = await mount(
        <SurveyVersionPreview
            questions={questions}
            survey={survey}
            version={version}
        />,
    );

    await expect(
        component.getByText(
            'Pregled je lokalna simulacija. Ne stvara dodjelu ni odgovor i ne šalje obavijesti.',
        ),
    ).toBeVisible();
    const submit = component.getByRole('button', {
        name: 'Pregled — slanje isključeno',
    });
    await expect(submit).toBeDisabled();
    await component.getByRole('button', { name: '3' }).click();
    await expect(component.getByRole('button', { name: '3' })).toHaveAttribute(
        'aria-pressed',
        'true',
    );

    await component.getByRole('button', { name: 'Zahvala' }).click();
    await expect(component.getByText('Hvala!')).toBeVisible();
    await expect(component.getByText('Pregled završnog stanja.')).toBeVisible();
});
