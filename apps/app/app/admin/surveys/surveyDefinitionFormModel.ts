import type {
    SelectSurveyQuestion,
    SelectSurveyVersion,
    SurveyQuestionInput,
    SurveyQuestionScoreMetadata,
} from '@gredice/storage';

export type SurveyDefinitionFormValues = {
    key: string;
    title: string;
    description: string;
    category: string;
    introTitle: string;
    introDescription: string;
    thankYouTitle: string;
    thankYouDescription: string;
    questions: SurveyQuestionFormState[];
};

export type SurveyQuestionFormState = {
    id: string;
    key: string;
    title: string;
    description?: string | null;
    type: SurveyQuestionInput['type'];
    required: boolean;
    scoreMetadata?: SurveyQuestionScoreMetadata;
    opinionMin: number;
    opinionMax: number;
    opinionStep?: number;
    opinionMinLabel?: string | null;
    opinionMaxLabel?: string | null;
    longTextMaxLength?: number;
    longTextPlaceholder?: string | null;
    contactFields: Array<'first_name' | 'last_name' | 'phone' | 'email'>;
    contactPhoneDefaultCountry?: string | null;
};

const contactFieldOrder = [
    'first_name',
    'last_name',
    'phone',
    'email',
] as const;

export function createSurveyQuestionFormState(
    type: SurveyQuestionInput['type'],
    id: string,
    key: string,
): SurveyQuestionFormState {
    return surveyQuestionToFormState(
        type === 'opinion_scale'
            ? {
                  key,
                  title: 'Ocjena',
                  type,
                  required: false,
                  settings: { type, min: 0, max: 10, step: 1 },
                  scoreMetadata: {
                      internalScore: true,
                      publicScore: false,
                      npsLike: false,
                  },
              }
            : type === 'long_text'
              ? {
                    key,
                    title: 'Tekstualni odgovor',
                    type,
                    required: false,
                    settings: { type, maxLength: 2000 },
                }
              : {
                    key,
                    title: 'Kontakt podaci',
                    type,
                    required: false,
                    settings: {
                        type,
                        fields: [...contactFieldOrder],
                        phoneDefaultCountry: 'HR',
                    },
                },
        id,
    );
}

export function emptySurveyDefinitionFormValues(): SurveyDefinitionFormValues {
    return {
        key: '',
        title: '',
        description: '',
        category: 'general',
        introTitle: '',
        introDescription: '',
        thankYouTitle: '',
        thankYouDescription: '',
        questions: [
            createSurveyQuestionFormState(
                'opinion_scale',
                'score-question',
                'score',
            ),
        ],
    };
}

export function surveyVersionToFormValues({
    category = 'general',
    key = '',
    questions,
    version,
}: {
    category?: string;
    key?: string;
    questions: SelectSurveyQuestion[];
    version: SelectSurveyVersion;
}): SurveyDefinitionFormValues {
    return {
        key,
        title: version.title,
        description: version.description ?? '',
        category,
        introTitle: version.introTitle ?? '',
        introDescription: version.introDescription ?? '',
        thankYouTitle: version.thankYouTitle ?? '',
        thankYouDescription: version.thankYouDescription ?? '',
        questions: questions.map((question) =>
            surveyQuestionToFormState(question, question.id),
        ),
    };
}

export function setSurveyContactField(
    question: SurveyQuestionFormState,
    field: (typeof contactFieldOrder)[number],
    checked: boolean,
) {
    const fields = new Set(question.contactFields);
    if (checked) {
        fields.add(field);
    } else {
        fields.delete(field);
    }
    return {
        ...question,
        contactFields: contactFieldOrder.filter((item) => fields.has(item)),
    };
}

export function surveyQuestionToFormState(
    question: SurveyQuestionInput,
    id: string,
): SurveyQuestionFormState {
    const state: SurveyQuestionFormState = {
        id,
        key: question.key,
        title: question.title,
        description: question.description,
        type: question.type,
        required: question.required ?? false,
        scoreMetadata: question.scoreMetadata,
        opinionMin: 0,
        opinionMax: 10,
        contactFields: [],
    };

    if (question.settings.type === 'opinion_scale') {
        return {
            ...state,
            opinionMin: question.settings.min,
            opinionMax: question.settings.max,
            opinionStep: question.settings.step,
            opinionMinLabel: question.settings.minLabel,
            opinionMaxLabel: question.settings.maxLabel,
        };
    }

    if (question.settings.type === 'long_text') {
        return {
            ...state,
            longTextMaxLength: question.settings.maxLength,
            longTextPlaceholder: question.settings.placeholder,
        };
    }

    return {
        ...state,
        contactFields: [...question.settings.fields],
        contactPhoneDefaultCountry: question.settings.phoneDefaultCountry,
    };
}

export function surveyQuestionFromFormState(
    question: SurveyQuestionFormState,
): SurveyQuestionInput {
    const base = {
        key: question.key,
        title: question.title,
        type: question.type,
        required: question.required,
        ...(question.description === undefined
            ? {}
            : { description: question.description }),
        ...(question.scoreMetadata === undefined
            ? {}
            : { scoreMetadata: question.scoreMetadata }),
    };

    if (question.type === 'opinion_scale') {
        return {
            ...base,
            type: question.type,
            settings: {
                type: question.type,
                min: question.opinionMin,
                max: question.opinionMax,
                ...(question.opinionStep === undefined
                    ? {}
                    : { step: question.opinionStep }),
                ...(question.opinionMinLabel === undefined
                    ? {}
                    : { minLabel: question.opinionMinLabel }),
                ...(question.opinionMaxLabel === undefined
                    ? {}
                    : { maxLabel: question.opinionMaxLabel }),
            },
        };
    }

    if (question.type === 'long_text') {
        return {
            ...base,
            type: question.type,
            settings: {
                type: question.type,
                ...(question.longTextMaxLength === undefined
                    ? {}
                    : { maxLength: question.longTextMaxLength }),
                ...(question.longTextPlaceholder === undefined
                    ? {}
                    : { placeholder: question.longTextPlaceholder }),
            },
        };
    }

    return {
        ...base,
        type: question.type,
        settings: {
            type: question.type,
            fields: [...question.contactFields],
            ...(question.contactPhoneDefaultCountry === undefined
                ? {}
                : {
                      phoneDefaultCountry: question.contactPhoneDefaultCountry,
                  }),
        },
    };
}
