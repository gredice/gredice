import { readOperationRequestNote } from '@gredice/js/operations';

// Keep the note out of the JSON metadata value: escaping and other operation
// details can otherwise exceed Stripe's per-value limit, even for a short note.
export function operationRequestNoteMetadata(
    additionalData: unknown,
): Record<string, string> {
    const requestNote = readOperationRequestNote(additionalData);
    if (!requestNote) return {};
    if (!additionalData || typeof additionalData !== 'object') return {};
    const data = { ...additionalData };
    if ('requestNote' in data) delete data.requestNote;
    return {
        additionalData: JSON.stringify(data),
        operationRequestNote: requestNote,
    };
}

export function readCheckoutProductAdditionalData(
    metadata: Record<string, string | undefined> | undefined,
): unknown {
    const additionalData: unknown = metadata?.additionalData
        ? JSON.parse(metadata.additionalData)
        : {};
    if (!metadata?.operationRequestNote) return additionalData;
    if (
        !additionalData ||
        typeof additionalData !== 'object' ||
        Array.isArray(additionalData)
    ) {
        throw new Error('Invalid operation checkout data.');
    }
    return {
        ...additionalData,
        requestNote: metadata.operationRequestNote,
    };
}
