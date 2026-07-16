export function buildOperationCompletionEvidenceActionArguments({
    expectedTaskVersionEventId,
    imageUrls,
    notes,
    operationId,
}: {
    expectedTaskVersionEventId: number;
    imageUrls: string[];
    notes: string;
    operationId: number;
}) {
    return [operationId, expectedTaskVersionEventId, imageUrls, notes] as const;
}
