import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SurveyQuestionInput } from '@gredice/storage';
import {
    surveyQuestionFromFormState,
    surveyQuestionToFormState,
} from './surveyDefinitionFormModel';

describe('survey definition form model', () => {
    it('round-trips every supported question setting and score flag', () => {
        const questions = [
            {
                key: 'recommendation',
                title: 'Koliko biste nas preporučili?',
                description: 'Odaberite broj.',
                type: 'opinion_scale',
                required: true,
                settings: {
                    type: 'opinion_scale',
                    min: 1,
                    max: 7,
                    step: 2,
                    minLabel: 'Nikako',
                    maxLabel: 'Svakako',
                },
                scoreMetadata: {
                    internalScore: true,
                    publicScore: true,
                    npsLike: true,
                },
            },
            {
                key: 'comment',
                title: 'Što možemo poboljšati?',
                description: null,
                type: 'long_text',
                required: false,
                settings: {
                    type: 'long_text',
                    maxLength: 750,
                    placeholder: 'Napišite komentar',
                },
                scoreMetadata: {},
            },
            {
                key: 'contact',
                title: 'Kako vas možemo kontaktirati?',
                description: 'Ostavite željene podatke.',
                type: 'contact_info',
                required: true,
                settings: {
                    type: 'contact_info',
                    fields: ['first_name', 'phone', 'email'],
                    phoneDefaultCountry: 'SI',
                },
                scoreMetadata: {},
            },
        ] satisfies SurveyQuestionInput[];

        assert.deepEqual(
            questions.map((question, index) =>
                surveyQuestionFromFormState(
                    surveyQuestionToFormState(question, `question-${index}`),
                ),
            ),
            questions,
        );
    });

    it('does not invent absent optional settings or score metadata', () => {
        const questions = [
            {
                key: 'score',
                title: 'Score',
                type: 'opinion_scale',
                settings: {
                    type: 'opinion_scale',
                    min: 0,
                    max: 10,
                },
            },
            {
                key: 'comment',
                title: 'Comment',
                type: 'long_text',
                settings: { type: 'long_text' },
            },
            {
                key: 'contact',
                title: 'Contact',
                type: 'contact_info',
                settings: {
                    type: 'contact_info',
                    fields: ['email'],
                },
            },
        ] satisfies SurveyQuestionInput[];

        assert.deepEqual(
            questions.map((question, index) =>
                surveyQuestionFromFormState(
                    surveyQuestionToFormState(question, `optional-${index}`),
                ),
            ),
            questions.map((question) => ({
                ...question,
                required: false,
            })),
        );
    });
});
