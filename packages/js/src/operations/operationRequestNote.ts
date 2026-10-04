export const operationRequestNoteMaxLength = 500;

export function normalizeOperationRequestNote(value: unknown) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
        throw new Error('Napomena za vrtlara mora biti tekst.');
    }
    const note = value.trim();
    if (note.length > operationRequestNoteMaxLength) {
        throw new Error(
            `Napomena za vrtlara može imati najviše ${operationRequestNoteMaxLength} znakova.`,
        );
    }
    return note || undefined;
}

export function readOperationRequestNote(additionalData: unknown) {
    const data: unknown =
        typeof additionalData === 'string'
            ? JSON.parse(additionalData)
            : additionalData;
    return normalizeOperationRequestNote(
        data && typeof data === 'object' && 'requestNote' in data
            ? data.requestNote
            : undefined,
    );
}
