export type SurveyQuestionSettings =
    | {
          max: number;
          maxLabel?: string | null;
          min: number;
          minLabel?: string | null;
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

export type SurveyQuestionnaireQuestion = {
    description: string | null;
    id: string;
    key: string;
    required: boolean;
    settings: SurveyQuestionSettings;
    sortOrder: number;
    title: string;
    type: 'opinion_scale' | 'long_text' | 'contact_info';
};

export type SurveyContactValue = {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
};

export type SurveyAnswerValue =
    | number
    | string
    | SurveyContactValue
    | undefined;

export type SurveyAnswerState = Record<string, SurveyAnswerValue>;

export function isSurveyContactValue(
    value: SurveyAnswerValue,
): value is SurveyContactValue {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasSurveyContactValue(value: SurveyAnswerValue) {
    if (!isSurveyContactValue(value)) return false;
    return Boolean(
        value.firstName || value.lastName || value.phone || value.email,
    );
}
