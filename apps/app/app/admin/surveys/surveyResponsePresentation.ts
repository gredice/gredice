import type {
    SurveyResponseAnswerDetail,
    SurveyResponseSource,
} from '@gredice/storage';

export function surveyResponseSourceLabel(source: SurveyResponseSource) {
    switch (source) {
        case 'in_app':
            return 'U aplikaciji';
        case 'typeform':
            return 'Typeform';
        case 'admin_import':
            return 'Administratorski uvoz';
    }
}

export function surveyResponseAnswerValue({
    answer,
}: SurveyResponseAnswerDetail) {
    if (answer.skipped) return 'Preskočeno';
    if (answer.numericValue !== null) return answer.numericValue.toString();
    if (answer.textValue) return answer.textValue;
    if (answer.contactValue) {
        const fields = [
            answer.contactValue.firstName,
            answer.contactValue.lastName,
            answer.contactValue.phone,
            answer.contactValue.email,
        ].filter((value): value is string => Boolean(value));
        return fields.join(', ') || 'Kontakt podaci nisu uneseni';
    }
    return 'Bez odgovora';
}

export function surveyResponseContextLabel(
    contextKey: string | null | undefined,
    monthKey: unknown,
) {
    if (typeof monthKey === 'string' && monthKey.trim()) {
        return contextKey ? `${monthKey} · ${contextKey}` : monthKey;
    }
    return contextKey || 'Bez konteksta';
}
