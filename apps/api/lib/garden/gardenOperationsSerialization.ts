type GardenOperationEvidenceInput = {
    status: string;
    imageUrls?: string[] | null;
    completionNotes?: string | null;
};

export function serializeGardenOperationEvidence(
    operation: GardenOperationEvidenceInput,
) {
    if (operation.status !== 'completed') {
        return {
            imageUrls: [],
            completionNotes: null,
        };
    }

    return {
        imageUrls: operation.imageUrls ?? [],
        completionNotes: operation.completionNotes ?? null,
    };
}
