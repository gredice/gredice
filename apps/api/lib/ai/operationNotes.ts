export const MAX_OPERATION_NOTE_LENGTH = 600;

/**
 * Operation notes are free text written by gardeners in the field. They are
 * data for the model, never instructions, so control characters are stripped
 * and the note is capped before it reaches a prompt or tool result.
 */
export function normalizeOperationNote(value: string | null | undefined) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const sanitized = value
        .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!sanitized) {
        return undefined;
    }

    return sanitized.length > MAX_OPERATION_NOTE_LENGTH
        ? `${sanitized.slice(0, MAX_OPERATION_NOTE_LENGTH)}…`
        : sanitized;
}
