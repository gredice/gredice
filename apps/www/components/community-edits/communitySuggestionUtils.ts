/** The one sentence every community dialog uses to explain moderation. */
export const communityReviewPromise =
    'Pregledamo svaki prijedlog prije objave i javimo ti ishod.';

export const communitySubmitLabel = 'Pošalji prijedlog';

export const communitySubmitFailedMessage = 'Slanje prijedloga nije uspjelo.';

export const communityLoginDescription =
    'Za slanje prijedloga treba se prijaviti. Nakon prijave nastavljaš s prijedlogom.';

export const communitySourceMaxLength = 500;
export const communityReasonMaxLength = 1400;

export function errorMessage(value: unknown) {
    if (
        typeof value === 'object' &&
        value !== null &&
        'message' in value &&
        typeof value.message === 'string'
    ) {
        return value.message;
    }
    if (value instanceof Error) {
        return value.message;
    }
    return communitySubmitFailedMessage;
}

export function isSubmitResponse(
    value: unknown,
): value is { requestId: number } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'requestId' in value &&
        typeof value.requestId === 'number'
    );
}

/**
 * The API keeps one free-text note per request. Source and reason are asked
 * separately and stored as readable text the moderator sees as written.
 */
export function composeSubmitterNote(source: string, reason: string) {
    const trimmedSource = source.trim();
    const note = [trimmedSource ? `Izvor: ${trimmedSource}` : '', reason.trim()]
        .filter(Boolean)
        .join('\n\n');

    return note ? note.slice(0, 2000) : null;
}
